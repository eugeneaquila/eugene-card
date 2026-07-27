// Firebase Initialization Config
const firebaseConfig = {
  apiKey: "AIzaSyCm13Nh6k6W9wsL0_OPpjKZNrbSg-pFsuA",
  authDomain: "eugene-card-marketplace.firebaseapp.com",
  projectId: "eugene-card-marketplace",
  storageBucket: "eugene-card-marketplace.firebasestorage.app",
  messagingSenderId: "789014481646",
  appId: "1:789014481646:web:3858909b429985005a41ff"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

let currentTab = 'catalog';
let cardsData = [];
let activeAuction = null;
let auctionTimerInterval = null;
let currentUser = { email: "eugene.aquila06@gmail.com", displayName: "Eugene" };
let unreadChatNotifications = [];

const DEFAULT_QRIS_IMAGE = "https://iili.io/CekvjN2.png";
const FEATURED_AUCTION_DOC_ID = "featured_active";

document.addEventListener('DOMContentLoaded', () => {
  fetchInventoryData();
  listenToLiveAuction();
  listenForUnreadChatsAsNotifications();
  switchTab('catalog');
});

function switchTab(tabName) {
  currentTab = tabName;
  
  ['catalog', 'auction', 'inbox'].forEach(sec => {
    const el = document.getElementById(`view-${sec}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white');
    btn.classList.add('text-slate-400');
  });

  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-800', 'text-white');
  }

  if (tabName === 'auction') renderAuctionRoom();
  if (tabName === 'inbox') loadUserInboxThreads();
}

// LIVE REAL-TIME AUCTION & BID HISTORY LISTENER
function listenToLiveAuction() {
  db.collection("auctions").doc(FEATURED_AUCTION_DOC_ID)
    .onSnapshot((doc) => {
      if (doc.exists) {
        activeAuction = { id: doc.id, ...doc.data() };
      } else {
        // Fallback default structure for *007 card
        activeAuction = {
          id: FEATURED_AUCTION_DOC_ID,
          cardName: "Eugene Standard #007",
          serial: "*007",
          owner: "andi_rende",
          startingBid: 0,
          highestBid: 0,
          highBidder: "None",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 11196000).toISOString(),
          bids: []
        };
      }
      if (currentTab === 'auction') renderAuctionRoom();
    }, (err) => console.error("Error listening to real-time auction:", err));
}

function renderAuctionRoom() {
  const container = document.getElementById('view-auction');
  if (!container) return;

  if (auctionTimerInterval) {
    clearInterval(auctionTimerInterval);
    auctionTimerInterval = null;
  }

  const auctionData = activeAuction || {
    cardName: "Eugene Standard #007",
    serial: "*007",
    owner: "andi_rende",
    highestBid: 0,
    highBidder: "None",
    expiresAt: new Date(Date.now() + 11196000).toISOString(),
    bids: []
  };

  const titleEl = document.getElementById('auction-card-title');
  if (titleEl) titleEl.textContent = auctionData.cardName;

  const serialEl = document.getElementById('auction-card-serial');
  if (serialEl) serialEl.textContent = auctionData.serial;

  const ownerEl = document.getElementById('auction-card-owner');
  if (ownerEl) ownerEl.textContent = auctionData.owner;

  const bidEl = document.getElementById('auction-current-bid');
  if (bidEl) bidEl.textContent = `Rp ${(auctionData.highestBid || 0).toLocaleString('id-ID')}`;

  const bidderEl = document.getElementById('auction-high-bidder');
  if (bidderEl) bidderEl.textContent = auctionData.highBidder || "None";

  // Render Bid History Log
  const historyContainer = document.getElementById('auction-bid-history');
  if (historyContainer) {
    const historyList = auctionData.bids || [];
    if (historyList.length === 0) {
      historyContainer.innerHTML = `<p class="text-xs text-slate-500 text-center py-6">No bids recorded yet.</p>`;
    } else {
      historyContainer.innerHTML = historyList.slice().reverse().map(b => `
        <div class="py-2 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-white">${b.bidder || 'Collector'}</p>
            <p class="text-[10px] text-slate-500">${b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : 'Just now'}</p>
          </div>
          <span class="font-mono font-bold text-emerald-400">Rp ${(b.amount || 0).toLocaleString('id-ID')}</span>
        </div>
      `).join('');
    }
  }

  startLiveAuctionCountdown(auctionData.expiresAt);
}

function startLiveAuctionCountdown(expiresAtString) {
  const timerDisplay = document.getElementById('auction-timer-display');
  if (!timerDisplay) return;

  const targetTime = new Date(expiresAtString || Date.now() + 11196000).getTime();

  auctionTimerInterval = setInterval(() => {
    const now = Date.now();
    const distance = targetTime - now;

    if (distance < 0) {
      clearInterval(auctionTimerInterval);
      timerDisplay.textContent = "Auction Ended";
      return;
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    timerDisplay.textContent = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }, 1000);
}

// INPUT PARSING & BID SUBMISSION
async function placeAuctionBid() {
  const bidInput = document.getElementById('bid-input-amount');
  if (!bidInput) return;

  // Clean raw string (handles "100000", "100.000", "100,000", "Rp 100000")
  const rawString = bidInput.value || '';
  const cleanDigits = rawString.replace(/[^0-9]/g, '');
  const bidAmount = parseInt(cleanDigits, 10) || 0;

  const currentHighest = activeAuction ? (activeAuction.highestBid || 0) : 0;

  if (bidAmount <= 0) {
    showToast("Please enter a valid bid amount.");
    return;
  }

  if (bidAmount <= currentHighest) {
    showToast(`Bid must be higher than current bid (Rp ${currentHighest.toLocaleString('id-ID')})`);
    return;
  }

  const modalTitle = document.getElementById('checkout-modal-title');
  if (modalTitle) modalTitle.textContent = `Confirm QRIS Bid for ${activeAuction ? activeAuction.cardName : 'Eugene Standard #007'}`;

  const amountDisplay = document.getElementById('qris-amount-display');
  if (amountDisplay) amountDisplay.textContent = `Rp ${bidAmount.toLocaleString('id-ID')}`;

  const actionBtn = document.getElementById('checkout-action-btn');
  if (actionBtn) actionBtn.onclick = () => finalizeAuctionBid(bidAmount);

  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('hidden');
}

// ATOMIC FIRESTORE BID TRANSACTION
async function finalizeAuctionBid(bidAmount) {
  const btn = document.getElementById('checkout-action-btn');
  if (btn) btn.disabled = true;

  const bidderName = currentUser ? (currentUser.displayName || currentUser.email) : 'Collector';
  const auctionRef = db.collection("auctions").doc(FEATURED_AUCTION_DOC_ID);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(auctionRef);

      if (!doc.exists) {
        transaction.set(auctionRef, {
          cardName: "Eugene Standard #007",
          serial: "*007",
          owner: "andi_rende",
          highestBid: bidAmount,
          highBidder: bidderName,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 11196000).toISOString(),
          bids: [{ bidder: bidderName, amount: bidAmount, timestamp: new Date().toISOString() }]
        });
        return;
      }

      const data = doc.data();
      const currentHighest = data.highestBid || 0;

      if (bidAmount <= currentHighest) {
        throw new Error(`Your bid of Rp ${bidAmount.toLocaleString('id-ID')} was outbid. Current bid is Rp ${currentHighest.toLocaleString('id-ID')}`);
      }

      const updatedBids = Array.isArray(data.bids) ? data.bids : [];
      updatedBids.push({
        bidder: bidderName,
        amount: bidAmount,
        timestamp: new Date().toISOString()
      });

      transaction.update(auctionRef, {
        highestBid: bidAmount,
        highBidder: bidderName,
        bids: updatedBids
      });
    });

    closeCheckoutModal();
    const bidInput = document.getElementById('bid-input-amount');
    if (bidInput) bidInput.value = '';
    showToast(`Bid of Rp ${bidAmount.toLocaleString('id-ID')} placed successfully!`);
  } catch (err) {
    console.error("Auction Transaction Error:", err);
    showToast(err.message || "Failed to submit bid. Please try again.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.add('hidden');
}

function listenForUnreadChatsAsNotifications() {
  const myEmail = currentUser ? currentUser.email : 'collector@eugene.com';

  db.collection("messages")
    .where("recipient", "==", myEmail)
    .where("read", "==", false)
    .onSnapshot(snapshot => {
      unreadChatNotifications = [];
      snapshot.forEach(doc => unreadChatNotifications.push({ id: doc.id, ...doc.data() }));
      updateNotificationBadgeUI();
    }, err => console.error("Error listening to unread chats:", err));
}

function updateNotificationBadgeUI() {
  const badge = document.getElementById('notification-badge');
  const notifList = document.getElementById('notification-list');
  if (!badge || !notifList) return;

  const count = unreadChatNotifications.length;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');

    notifList.innerHTML = unreadChatNotifications.map(msg => `
      <div onclick="switchTab('inbox')" class="p-3 hover:bg-slate-950 cursor-pointer flex items-start gap-2.5">
        <div class="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <i class="fa-solid fa-comment-dots text-xs"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-white truncate">${msg.sender || 'Collector'}</p>
          <p class="text-[11px] text-slate-400 truncate">${msg.text || '[Image / Attachment]'}</p>
        </div>
      </div>
    `).join('');
  } else {
    badge.classList.add('hidden');
    notifList.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">No new notifications.</div>`;
  }
}

function toggleNotificationMenu() {
  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function fetchInventoryData() {
  db.collection("cards").onSnapshot(snapshot => {
    cardsData = [];
    snapshot.forEach(doc => cardsData.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'catalog') renderCardGrid();
  }, err => console.error("Error fetching inventory:", err));
}

function renderCardGrid() {
  const container = document.getElementById('card-grid');
  if (!container) return;

  if (cardsData.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No cards available.</div>`;
    return;
  }

  container.innerHTML = cardsData.map(card => `
    <div class="card-holo-standard rounded-2xl p-3 space-y-2">
      <div class="flex justify-between items-center text-[10px] font-extrabold text-amber-400 font-mono">
        <span>${card.serial || '*0001'}</span>
        <span>${card.type || 'STANDARD'}</span>
      </div>
      <div class="w-full aspect-[4/5] bg-slate-950 rounded-xl overflow-hidden p-1 border border-slate-800 flex items-center justify-center">
        <img src="${card.imgUrl || card.img || 'https://via.placeholder.com/150'}" class="h-full object-contain">
      </div>
      <h4 class="text-xs font-black text-white truncate">${card.name || 'Card Name'}</h4>
    </div>
  `).join('');
}

function loadUserInboxThreads() {
  const container = document.getElementById('inbox-threads-list');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-3xl">No chat conversations yet.</div>`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-20');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-20');
  }, 3000);
}