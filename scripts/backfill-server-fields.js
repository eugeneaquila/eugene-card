// Backfill helper for existing Eugene Card data.
// It resolves existing card owners / transaction users / trade identities against
// the profiles collection. Run once with a service-account credential after users
// have logged in at least once and syncProfile has populated uid fields.
//
// Usage:
// GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json node scripts/backfill-server-fields.js

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function profileByIdentity(identity) {
  if (!identity) return null;
  let snap = await db.collection('profiles').where('username', '==', identity).limit(1).get();
  if (!snap.empty) return snap.docs[0].data();
  snap = await db.collection('profiles').where('name', '==', identity).limit(1).get();
  if (!snap.empty) return snap.docs[0].data();
  return null;
}

(async () => {
  const cards = await db.collection('cards').get();
  let cardCount = 0;
  for (const doc of cards.docs) {
    const d = doc.data();
    if (!d.owner || d.ownerUid) continue;
    const p = await profileByIdentity(d.owner);
    if (p?.uid) {
      await doc.ref.update({ ownerUid: p.uid });
      cardCount++;
    }
  }

  const txs = await db.collection('transactions').get();
  let txCount = 0;
  for (const doc of txs.docs) {
    const d = doc.data();
    if (!d.user_name || d.userUid) continue;
    const p = await profileByIdentity(d.user_name);
    if (p?.uid) {
      await doc.ref.update({ userUid: p.uid });
      txCount++;
    }
  }

  const trades = await db.collection('tradeRequests').get();
  let tradeCount = 0;
  for (const doc of trades.docs) {
    const d = doc.data();
    const patch = {};
    if (!d.proposerUid && d.proposer) {
      const p = await profileByIdentity(d.proposer);
      if (p?.uid) patch.proposerUid = p.uid;
    }
    if (!d.targetOwnerUid && d.targetOwner) {
      const p = await profileByIdentity(d.targetOwner);
      if (p?.uid) patch.targetOwnerUid = p.uid;
    }
    if (Object.keys(patch).length) {
      await doc.ref.update(patch);
      tradeCount++;
    }
  }

  console.log(JSON.stringify({ cardCount, txCount, tradeCount }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
