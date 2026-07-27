const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const TRADE_FEE_PERCENT = 0.02;

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  return request.auth;
}

function requireAdmin(request) {
  const auth = requireAuth(request);
  if (auth.token.admin !== true) throw new HttpsError('permission-denied', 'Admin permission required.');
  return auth;
}

function cleanString(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

async function getProfileByUid(uid) {
  const snap = await db.collection('profiles').where('uid', '==', uid).limit(1).get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  const user = await admin.auth().getUser(uid);
  const email = (user.email || '').toLowerCase();
  const ref = db.collection('profiles').doc(email);
  const doc = await ref.get();
  if (doc.exists) return { id: doc.id, ...doc.data(), uid };
  return {
    id: email || uid,
    uid,
    email,
    name: user.displayName || email.split('@')[0] || 'Collector',
    username: (user.displayName || email.split('@')[0] || 'collector').toLowerCase().replace(/\s+/g, '_')
  };
}

async function getUserByIdentity(identity) {
  const value = cleanString(identity, 120);
  if (!value) throw new HttpsError('invalid-argument', 'Collector identity is required.');

  const byUsername = await db.collection('profiles').where('username', '==', value).limit(1).get();
  if (!byUsername.empty) return { id: byUsername.docs[0].id, ...byUsername.docs[0].data() };

  const byName = await db.collection('profiles').where('name', '==', value).limit(1).get();
  if (!byName.empty) return { id: byName.docs[0].id, ...byName.docs[0].data() };

  if (value.includes('@')) {
    try {
      const user = await admin.auth().getUserByEmail(value.toLowerCase());
      return { uid: user.uid, email: user.email, name: user.displayName || value, username: value.split('@')[0] };
    } catch (_) {}
  }

  throw new HttpsError('not-found', `Collector "${value}" could not be resolved.`);
}

async function ensureStats(uid) {
  const ref = db.collection('collectorStats').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid,
      xp: 0,
      reputation: 0,
      completedTrades: 0,
      auctionWins: 0,
      purchases: 0,
      sales: 0,
      level: 1,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  return ref;
}

function xpToLevel(xp) {
  return Math.max(1, Math.floor(Number(xp || 0) / 100) + 1);
}

async function incrementStats(uid, delta) {
  if (!uid) return;
  const ref = await ensureStats(uid);
  const snap = await ref.get();
  const old = snap.data() || {};
  const xp = Math.max(0, Number(old.xp || 0) + Number(delta.xp || 0));
  const reputation = Math.max(0, Number(old.reputation || 0) + Number(delta.reputation || 0));
  await ref.set({
    ...delta,
    xp,
    reputation,
    level: xpToLevel(xp),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function createNotification(recipientUid, title, message, type = 'info', data = {}) {
  if (!recipientUid) return;
  await db.collection('notifications').add({
    recipientUid,
    title: cleanString(title, 120),
    message: cleanString(message, 500),
    type: cleanString(type, 50),
    data,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });
}

// Keep a secure server-side profile mirror. The browser never writes this directly.
exports.syncProfile = onCall(async (request) => {
  const auth = requireAuth(request);
  const user = await admin.auth().getUser(auth.uid);
  const email = (user.email || '').toLowerCase();
  const data = request.data || {};
  const existing = await getProfileByUid(auth.uid);

  const username = cleanString(data.username || existing.username || user.displayName || email.split('@')[0], 80)
    .replace(/^@/, '').toLowerCase().replace(/\s+/g, '_');

  const payload = {
    uid: auth.uid,
    email,
    name: cleanString(data.name || existing.name || user.displayName || email.split('@')[0], 120),
    username,
    avatarUrl: cleanString(data.avatarUrl || existing.avatarUrl || user.photoURL || '', 1000),
    bio: cleanString(data.bio || existing.bio || '', 500),
    socialIg: cleanString(data.socialIg || existing.socialIg || '', 500),
    socialTwitter: cleanString(data.socialTwitter || existing.socialTwitter || '', 500),
    socialTiktok: cleanString(data.socialTiktok || existing.socialTiktok || '', 500),
    socialWeb: cleanString(data.socialWeb || existing.socialWeb || '', 500),
    isPlusMember: existing.isPlusMember === true,
    updatedAt: FieldValue.serverTimestamp()
  };

  const existingUsername = await db.collection('profiles')
    .where('username', '==', username).limit(2).get();
  const conflict = existingUsername.docs.find(d => d.id !== existing.id && d.data().uid !== auth.uid);
  if (conflict) throw new HttpsError('already-exists', 'Username is already taken.');

  await db.collection('profiles').doc(email || auth.uid).set(payload, { merge: true });
  await ensureStats(auth.uid);

  return { ok: true, profile: { ...payload, updatedAt: undefined } };
});

exports.createTradeRequest = onCall(async (request) => {
  const auth = requireAuth(request);
  const { cardId, offerType = 'BUY', offeredCardId = null, plusAmount = 0, notes = '' } = request.data || {};
  if (!cardId) throw new HttpsError('invalid-argument', 'Target card is required.');

  const proposer = await getProfileByUid(auth.uid);
  const cardRef = db.collection('cards').doc(cardId);
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists) throw new HttpsError('not-found', 'Target card not found.');
  const card = cardSnap.data();

  if (!card.owner) throw new HttpsError('failed-precondition', 'This card is not owned by a collector.');
  if (card.owner === proposer.username || card.owner === proposer.name) {
    throw new HttpsError('failed-precondition', 'You cannot trade with yourself.');
  }

  const target = await getUserByIdentity(card.owner);
  let offered = null;
  if (offerType === 'TRADE') {
    if (!offeredCardId) throw new HttpsError('invalid-argument', 'A card to offer is required.');
    const offeredSnap = await db.collection('cards').doc(offeredCardId).get();
    if (!offeredSnap.exists) throw new HttpsError('not-found', 'Offered card not found.');
    offered = offeredSnap.data();
    if (offered.owner !== proposer.username && offered.owner !== proposer.name) {
      throw new HttpsError('permission-denied', 'You do not own the offered card.');
    }
    if (offered.status !== 'SOLD') {
      throw new HttpsError('failed-precondition', 'The offered card is not in your Vault.');
    }
  }

  const reqRef = db.collection('tradeRequests').doc();
  const reqData = {
    id: reqRef.id,
    cardId,
    serial: card.serial || cardId,
    cardName: card.name || 'Card',
    cardImg: card.imgUrl || '',
    targetOwner: card.owner,
    targetOwnerUid: target.uid,
    proposer: proposer.username || proposer.name,
    proposerUid: auth.uid,
    proposerName: proposer.name || proposer.username,
    offerType,
    offeredCardId: offeredCardId || null,
    offeredCardSerial: offered?.serial || null,
    offeredCardName: offered?.name || null,
    plusAmount: Math.max(0, Number(plusAmount || 0)),
    notes: cleanString(notes, 1000),
    status: 'PENDING',
    created_at: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp()
  };

  await reqRef.set(reqData);
  await createNotification(
    target.uid,
    'New Trade Offer',
    `${reqData.proposer} offered ${reqData.offeredCardSerial || 'a QRIS offer'} for ${reqData.serial}.`,
    'trade',
    { tradeRequestId: reqRef.id, cardId }
  );
  return { ok: true, requestId: reqRef.id };
});

exports.tradeAction = onCall(async (request) => {
  const auth = requireAuth(request);
  const { requestId, action, notes } = request.data || {};
  if (!requestId || !['accept', 'reject', 'counter', 'withdraw'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Invalid trade action.');
  }

  const reqRef = db.collection('tradeRequests').doc(requestId);

  let result;
  await db.runTransaction(async tx => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) throw new HttpsError('not-found', 'Trade request not found.');
    const req = reqSnap.data();

    if (action === 'withdraw') {
      if (req.proposerUid !== auth.uid) throw new HttpsError('permission-denied', 'Only the proposer can withdraw.');
      if (!['PENDING', 'COUNTERED'].includes(req.status)) throw new HttpsError('failed-precondition', 'Trade is no longer active.');
      tx.update(reqRef, { status: 'WITHDRAWN', updatedAt: FieldValue.serverTimestamp() });
      result = { notifyUid: req.targetOwnerUid, title: 'Trade Withdrawn', message: `${req.proposer} withdrew the offer for ${req.serial}.` };
      return;
    }

    if (action === 'counter') {
      if (req.targetOwnerUid !== auth.uid) throw new HttpsError('permission-denied', 'Only the card owner can counter.');
      if (req.status !== 'PENDING') throw new HttpsError('failed-precondition', 'Only pending offers can be countered.');
      const counterNotes = cleanString(notes, 1000);
      if (!counterNotes) throw new HttpsError('invalid-argument', 'Counter-offer notes are required.');
      tx.update(reqRef, { notes: counterNotes, status: 'COUNTERED', updatedAt: FieldValue.serverTimestamp() });
      result = { notifyUid: req.proposerUid, title: 'Counter Offer Received', message: `${req.targetOwner} sent a counter-offer for ${req.serial}.` };
      return;
    }

    if (action === 'reject') {
      const allowed = req.status === 'COUNTERED' ? req.proposerUid === auth.uid : req.targetOwnerUid === auth.uid;
      if (!allowed) throw new HttpsError('permission-denied', 'You cannot reject this offer.');
      if (!['PENDING', 'COUNTERED'].includes(req.status)) throw new HttpsError('failed-precondition', 'Trade is no longer active.');
      tx.update(reqRef, { status: 'REJECTED', updatedAt: FieldValue.serverTimestamp() });
      result = {
        notifyUid: req.proposerUid === auth.uid ? req.targetOwnerUid : req.proposerUid,
        title: 'Trade Offer Rejected',
        message: `${req.proposer} / ${req.targetOwner} rejected the offer for ${req.serial}.`
      };
      return;
    }

    const allowed = req.status === 'COUNTERED'
      ? req.proposerUid === auth.uid
      : req.targetOwnerUid === auth.uid || auth.token.admin === true;
    if (!allowed) throw new HttpsError('permission-denied', 'You cannot accept this offer.');
    if (!['PENDING', 'COUNTERED'].includes(req.status)) throw new HttpsError('failed-precondition', 'Trade is no longer active.');

    const targetCardRef = db.collection('cards').doc(req.cardId);
    const targetCardSnap = await tx.get(targetCardRef);
    if (!targetCardSnap.exists) throw new HttpsError('not-found', 'Target card no longer exists.');
    const targetCard = targetCardSnap.data();

    if (targetCard.owner !== req.targetOwner) {
      throw new HttpsError('aborted', 'Card ownership changed; refresh and retry.');
    }

    if (req.offerType === 'TRADE' && req.offeredCardId) {
      const offeredRef = db.collection('cards').doc(req.offeredCardId);
      const offeredSnap = await tx.get(offeredRef);
      if (!offeredSnap.exists) throw new HttpsError('not-found', 'Offered card no longer exists.');
      const offered = offeredSnap.data();
      if (offered.owner !== req.proposer) {
        throw new HttpsError('aborted', 'The offered card is no longer owned by the proposer.');
      }
      tx.update(offeredRef, { owner: req.targetOwner, status: 'SOLD', updatedAt: FieldValue.serverTimestamp() });
    }

    tx.update(targetCardRef, { owner: req.proposer, status: 'SOLD', updatedAt: FieldValue.serverTimestamp() });
    tx.update(reqRef, { status: 'ACCEPTED', acceptedByUid: auth.uid, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

    const transactionRef = db.collection('transactions').doc(`TRADE-${reqRef.id}`);
    tx.set(transactionRef, {
      id: transactionRef.id,
      userUid: req.proposerUid,
      user_name: req.proposer,
      source: 'TRADE',
      status: 'APPROVED',
      total_amount: Number(req.plusAmount || 0) * (1 + TRADE_FEE_PERCENT),
      items: [{ id: req.cardId, serial: req.serial, name: req.cardName, price: Number(targetCard.price || 0) }],
      created_at: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp()
    });

    result = {
      notifyUid: req.proposerUid,
      title: 'Trade Accepted',
      message: `${req.serial} was transferred to ${req.proposer}.`,
      proposerUid: req.proposerUid,
      sellerUid: req.targetOwnerUid
    };
  });

  if (result.sellerUid || result.title === 'Trade Accepted') {
    const proposerUid = result.proposerUid;
    const targetOwnerUid = result.sellerUid;
    if (proposerUid) await incrementStats(proposerUid, { xp: 100, reputation: 10, completedTrades: FieldValue.increment(1) });
    if (targetOwnerUid && targetOwnerUid !== proposerUid) {
      await incrementStats(targetOwnerUid, { xp: 100, reputation: 10, completedTrades: FieldValue.increment(1) });
    }
  }
  if (result.notifyUid) await createNotification(result.notifyUid, result.title, result.message, 'trade', { tradeRequestId: requestId });

  return { ok: true };
});

exports.createListing = onCall(async (request) => {
  const auth = requireAuth(request);
  const { cardId, price } = request.data || {};
  const amount = Number(price);
  if (!cardId || !Number.isFinite(amount) || amount <= 0) throw new HttpsError('invalid-argument', 'Valid card and price required.');

  const profile = await getProfileByUid(auth.uid);
  const cardRef = db.collection('cards').doc(cardId);
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists) throw new HttpsError('not-found', 'Card not found.');
  const card = cardSnap.data();
  if (card.owner !== profile.username && card.owner !== profile.name) throw new HttpsError('permission-denied', 'You do not own this card.');
  if (card.status !== 'SOLD') throw new HttpsError('failed-precondition', 'Only owned cards can be listed.');

  const listingId = `list-${cardId}`;
  await db.collection('listings').doc(listingId).set({
    cardId,
    serial: card.serial,
    name: card.name,
    type: card.type,
    imgUrl: card.imgUrl,
    price: amount,
    seller: profile.username || profile.name,
    sellerUid: auth.uid,
    created_at: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, listingId };
});

exports.startAuction = onCall(async (request) => {
  const auth = requireAuth(request);
  const { cardId, startingPrice, durationHours = 24 } = request.data || {};
  const price = Number(startingPrice);
  if (!cardId || !Number.isFinite(price) || price <= 0) throw new HttpsError('invalid-argument', 'Valid card and starting price required.');

  const profile = await getProfileByUid(auth.uid);
  const cardRef = db.collection('cards').doc(cardId);
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists) throw new HttpsError('not-found', 'Card not found.');
  const card = cardSnap.data();
  if (card.owner !== profile.username && card.owner !== profile.name) throw new HttpsError('permission-denied', 'You do not own this card.');
  if (card.status !== 'SOLD') throw new HttpsError('failed-precondition', 'Only owned cards can be auctioned.');

  const existing = await db.collection('system').doc('activeAuction').get();
  if (existing.exists) throw new HttpsError('failed-precondition', 'Another auction is already active.');

  const expiresAt = Timestamp.fromMillis(Date.now() + Math.min(Math.max(Number(durationHours) || 24, 1), 168) * 60 * 60 * 1000);
  await db.collection('system').doc('activeAuction').set({
    cardId,
    serial: card.serial,
    name: card.name,
    imgUrl: card.imgUrl,
    owner: profile.username || profile.name,
    ownerUid: auth.uid,
    startingPrice: price,
    currentBid: price,
    highBidder: 'None',
    highBidderUid: null,
    bidHistory: [],
    expiresAt,
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});

exports.placeAuctionBid = onCall(async (request) => {
  const auth = requireAuth(request);
  const bid = Number(request.data?.bidAmount);
  if (!Number.isFinite(bid) || bid <= 0) throw new HttpsError('invalid-argument', 'Valid bid amount required.');

  const profile = await getProfileByUid(auth.uid);
  let result = {};
  await db.runTransaction(async tx => {
    const ref = db.collection('system').doc('activeAuction');
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No active auction.');
    const auction = snap.data();
    if (auction.ownerUid === auth.uid) throw new HttpsError('permission-denied', 'You cannot bid on your own card.');

    const expiryMs = auction.expiresAt?.toMillis ? auction.expiresAt.toMillis() : new Date(auction.expiresAt).getTime();
    if (expiryMs <= Date.now()) throw new HttpsError('failed-precondition', 'Auction has ended.');

    const current = Number(auction.currentBid || auction.startingPrice || 0);
    if (bid <= current) throw new HttpsError('failed-precondition', `Bid must exceed ${current}.`);

    const history = Array.isArray(auction.bidHistory) ? auction.bidHistory.slice(-49) : [];
    history.push({ bidder: profile.username || profile.name, bidderUid: auth.uid, amount: bid, at: new Date().toISOString() });

    tx.update(ref, {
      currentBid: bid,
      highBidder: profile.username || profile.name,
      highBidderUid: auth.uid,
      bidHistory: history,
      updatedAt: FieldValue.serverTimestamp()
    });
    result = { previousBidderUid: auction.highBidderUid, serial: auction.serial, amount: bid };
  });

  if (result.previousBidderUid && result.previousBidderUid !== auth.uid) {
    await createNotification(result.previousBidderUid, 'You were outbid!', `${result.serial} is now at ${result.amount}.`, 'auction', { auctionId: 'activeAuction' });
  }
  await createNotification(auth.uid, 'Bid Placed', `You are now winning ${result.serial}.`, 'auction', { auctionId: 'activeAuction' });
  return { ok: true };
});

exports.finalizeAuction = onCall(async (request) => {
  const auth = requireAdmin(request);
  const result = {};

  await db.runTransaction(async tx => {
    const auctionRef = db.collection('system').doc('activeAuction');
    const auctionSnap = await tx.get(auctionRef);
    if (!auctionSnap.exists) throw new HttpsError('not-found', 'No active auction.');
    const auction = auctionSnap.data();

    const cardRef = db.collection('cards').doc(auction.cardId);
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists) throw new HttpsError('not-found', 'Auction card not found.');

    if (!auction.highBidderUid) {
      tx.delete(auctionRef);
      result.noWinner = true;
      return;
    }

    tx.update(cardRef, {
      owner: auction.highBidder,
      status: 'SOLD',
      updatedAt: FieldValue.serverTimestamp()
    });

    const orderRef = db.collection('transactions').doc(`AUC-${auctionRef.id}-${Date.now()}`);
    tx.set(orderRef, {
      id: orderRef.id,
      userUid: auction.highBidderUid,
      user_name: auction.highBidder,
      items: [{ id: auction.cardId, serial: auction.serial, name: auction.name, price: auction.currentBid, owner: auction.owner }],
      total_amount: Number(auction.currentBid || 0),
      status: 'APPROVED',
      source: 'AUCTION',
      created_at: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp()
    });
    tx.delete(auctionRef);

    result.winnerUid = auction.highBidderUid;
    result.ownerUid = auction.ownerUid;
    result.serial = auction.serial;
    result.amount = auction.currentBid;
    result.winner = auction.highBidder;
  });

  if (result.noWinner) return { ok: true, noWinner: true };

  await incrementStats(result.winnerUid, { xp: 150, reputation: 15, auctionWins: FieldValue.increment(1) });
  await incrementStats(result.ownerUid, { xp: 50, reputation: 5, sales: FieldValue.increment(1) });
  await createNotification(result.winnerUid, 'Auction Won!', `You won ${result.serial} for ${result.amount}.`, 'auction', { cardId: result.serial });
  await createNotification(result.ownerUid, 'Auction Sold', `${result.serial} sold for ${result.amount}.`, 'auction', { cardId: result.serial });

  return { ok: true, winner: result.winner };
});

exports.cancelAuction = onCall(async (request) => {
  const auth = requireAuth(request);
  await db.runTransaction(async tx => {
    const ref = db.collection('system').doc('activeAuction');
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No active auction.');
    const auction = snap.data();
    if (auction.ownerUid !== auth.uid && auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only the auction owner or admin can cancel it.');
    }
    tx.delete(ref);
  });
  return { ok: true };
});

exports.createOrder = onCall(async (request) => {
  const auth = requireAuth(request);
  const { cardIds, proofUrl = '' } = request.data || {};
  if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > 20) {
    throw new HttpsError('invalid-argument', 'Provide 1–20 card IDs.');
  }

  const profile = await getProfileByUid(auth.uid);
  const refs = cardIds.map(id => db.collection('cards').doc(String(id)));
  const snaps = await Promise.all(refs.map(r => r.get()));
  const items = [];
  let subtotal = 0;

  for (let i = 0; i < snaps.length; i++) {
    const snap = snaps[i];
    if (!snap.exists) throw new HttpsError('not-found', 'One of the selected cards no longer exists.');
    const card = snap.data();
    if (card.status !== 'AVAILABLE') throw new HttpsError('failed-precondition', `${card.serial} is no longer available.`);
    const price = Number(card.price || 0);
    subtotal += price;
    items.push({ id: snap.id, serial: card.serial, name: card.name, price });
  }

  const total = Math.round(subtotal * (1 + TRADE_FEE_PERCENT));
  const orderRef = db.collection('transactions').doc(`ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`);

  await db.runTransaction(async tx => {
    for (const id of cardIds) {
      const cardRef = db.collection('cards').doc(String(id));
      const snap = await tx.get(cardRef);
      if (!snap.exists || snap.data().status !== 'AVAILABLE') {
        throw new HttpsError('aborted', 'A card was just purchased by another collector. Please refresh.');
      }
    }
    tx.set(orderRef, {
      id: orderRef.id,
      userUid: auth.uid,
      user_name: profile.username || profile.name,
      items,
      subtotal,
      total_amount: total,
      status: 'PENDING',
      qrisProofUrl: cleanString(proofUrl, 2000),
      created_at: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp()
    });
  });

  await createNotification(auth.uid, 'QRIS Order Submitted', `${orderRef.id} is waiting for admin approval.`, 'order', { orderId: orderRef.id });
  return { ok: true, orderId: orderRef.id, total };
});

exports.reviewOrder = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { orderId, decision } = request.data || {};
  if (!orderId || !['APPROVED', 'REJECTED'].includes(decision)) throw new HttpsError('invalid-argument', 'Invalid order review.');

  let result = {};
  await db.runTransaction(async tx => {
    const orderRef = db.collection('transactions').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = orderSnap.data();
    if (order.status !== 'PENDING') throw new HttpsError('failed-precondition', 'Order has already been reviewed.');

    if (decision === 'APPROVED') {
      for (const item of (order.items || [])) {
        const cardRef = db.collection('cards').doc(item.id);
        const cardSnap = await tx.get(cardRef);
        if (!cardSnap.exists || cardSnap.data().status !== 'AVAILABLE') {
          throw new HttpsError('aborted', `${item.serial} is no longer available.`);
        }
        tx.update(cardRef, {
          owner: order.user_name,
          ownerUid: order.userUid,
          status: 'SOLD',
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }
    tx.update(orderRef, { status: decision, reviewedByUid: auth.uid, reviewedAt: FieldValue.serverTimestamp() });
    result = { userUid: order.userUid, orderId, decision, total: order.total_amount };
  });

  if (result.decision === 'APPROVED') {
    await incrementStats(result.userUid, { xp: 50, purchases: FieldValue.increment(1), reputation: 2 });
  }
  return { ok: true };
});

exports.deleteListing = onCall(async (request) => {
  const auth = requireAuth(request);
  const listingId = cleanString(request.data?.listingId, 200);
  if (!listingId) throw new HttpsError('invalid-argument', 'Listing ID is required.');

  const ref = db.collection('listings').doc(listingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Listing not found.');
  const listing = snap.data();

  if (listing.sellerUid !== auth.uid && auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Only the listing owner or admin can cancel it.');
  }
  await ref.delete();
  return { ok: true };
});

exports.sendChatMessage = onCall(async (request) => {
  const auth = requireAuth(request);
  const chatId = cleanString(request.data?.chatId, 200);
  const targetUser = cleanString(request.data?.targetUser, 120);
  const text = cleanString(request.data?.text, 2000);
  const imgUrl = cleanString(request.data?.imgUrl, 500000);
  if (!chatId || (!text && !imgUrl)) throw new HttpsError('invalid-argument', 'Message content is required.');

  const sender = await getProfileByUid(auth.uid);
  const target = await getUserByIdentity(targetUser);
  if (!target.uid) throw new HttpsError('failed-precondition', 'The recipient has not completed server profile setup.');

  const chatRef = db.collection('chats').doc(chatId);
  const messageRef = chatRef.collection('messages').doc();

  await db.runTransaction(async tx => {
    const chatSnap = await tx.get(chatRef);
    const existing = chatSnap.exists ? chatSnap.data() : {};
    const participantUids = Array.from(new Set([...(existing.participantUids || []), auth.uid, target.uid]));
    if (participantUids.length > 2 || (existing.participantUids && !existing.participantUids.includes(auth.uid))) {
      throw new HttpsError('permission-denied', 'You are not a participant in this chat.');
    }

    tx.set(chatRef, {
      participantUids,
      participantEmails: Array.from(new Set([...(existing.participantEmails || []), sender.email || '', target.email || ''])),
      participants: Array.from(new Set([...(existing.participants || []), sender.username || sender.name, target.username || target.name].map(v => String(v).toLowerCase()))),
      lastMessage: text || '[Screenshot / Image]',
      lastSender: sender.username || sender.name,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const payload = {
      senderUid: auth.uid,
      sender: sender.username || sender.name,
      text,
      timestamp: FieldValue.serverTimestamp()
    };
    if (imgUrl) payload.imgUrl = imgUrl;
    tx.set(messageRef, payload);
  });

  return { ok: true, messageId: messageRef.id };
});

// Server-generated notification triggers.
exports.notifyTradeRequestCreated = onDocumentCreated('tradeRequests/{requestId}', async event => {
  // createTradeRequest already creates the notification. This trigger intentionally
  // only fills legacy notifications if a server-side process creates a request.
  const data = event.data?.data();
  if (!data?.targetOwnerUid) return;
  const existing = await db.collection('notifications')
    .where('recipientUid', '==', data.targetOwnerUid)
    .where('data.tradeRequestId', '==', event.params.requestId)
    .limit(1).get();
  if (!existing.empty) return;
  await createNotification(data.targetOwnerUid, 'New Trade Offer', `${data.proposer} offered ${data.serial}.`, 'trade', { tradeRequestId: event.params.requestId });
});

exports.notifyTransactionChanges = onDocumentUpdated('transactions/{orderId}', async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || !after.userUid) return;
  await createNotification(after.userUid, `Order ${after.status}`, `${after.id || event.params.orderId} is now ${String(after.status).toLowerCase()}.`, 'order', { orderId: event.params.orderId });
});

exports.notifyChatMessages = onDocumentCreated('chats/{chatId}/messages/{messageId}', async event => {
  const msg = event.data?.data();
  if (!msg?.senderUid) return;
  const chatSnap = await db.collection('chats').doc(event.params.chatId).get();
  if (!chatSnap.exists) return;
  const chat = chatSnap.data();
  const recipients = (chat.participantUids || []).filter(uid => uid !== msg.senderUid);
  await Promise.all(recipients.map(uid =>
    createNotification(uid, 'New Inbox Message', msg.text || 'You received a new message.', 'chat', { chatId: event.params.chatId })
  ));
});
