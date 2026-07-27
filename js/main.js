// js/main.js

let currentTab = 'catalog';
let cardsData = [];
let activeAuction = null;
let auctionTimerInterval = null;
let currentUser = null;
let unreadChatNotifications = [];

const DEFAULT_QRIS_IMAGE = "https://iili.io/CekvjN2.png";

document.addEventListener('DOMContentLoaded', () => {
  fetchInventoryData();
  fetchActiveAuction();
  listenForUnreadChatsAsNotifications();
  switchTab('catalog');
});

function switchTab(tabName) {
  currentTab = tabName;
  
  const sections = ['catalog', 'trade', 'auction', 'trade-req', 'inbox', 'holders', 'history', 'dashboard', 'wishlist', 'admin', 'inventory'];
  sections.forEach(sec => {
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

function fetchActiveAuction() {
  db.collection("auctions").doc("featured_active").onSnapshot(doc => {
    if (doc.exists && doc.data().status === "ACTIVE") {
      activeAuction = doc.data();
    } else {
      activeAuction = null;
    }
    if (currentTab === 'auction') renderAuctionRoom();
  }, err => console.error("Error fetching auction:", err));
}

function renderAuctionRoom() {
  const container = document.getElementById('view-auction');
  if (!container) return;

  if (auctionTimerInterval) {
    clearInterval(auctionTimerInterval);
    auctionTimerInterval = null;
  }

  // Fallback state if activeAuction is not loaded yet
  const auctionData = activeAuction || {
    cardName: "Eugene Standard #007",
    serial: "*007",
    owner: "andi_rende",
    highestBid: 750000,
    highBidder: "Collector #104",
    expiresAt: new Date(Date.now() + 11196000).toISOString()
  };

  const titleEl = document.getElementById('auction-card-title');
  if (titleEl) titleEl.textContent = auctionData.cardName;

  const imgEl = document.getElementById('auction-card-img');
  if (imgEl && auctionData.imgUrl) imgEl.src = auctionData.imgUrl;

  const serialEl = document.getElementById('auction-card-serial');
  if (serialEl) serialEl.textContent = auctionData.serial;

  const ownerEl = document.getElementById('auction-card-owner');
  if (ownerEl) ownerEl.textContent = auctionData.owner;

  const bidEl = document.getElementById('auction-current-bid');
  if (bidEl) bidEl.textContent = `Rp ${(auctionData.highestBid || 750000).toLocaleString('id-ID')}`;

  const bidderEl = document.getElementById('auction-high-bidder');
  if (bidderEl) bidderEl.textContent = auctionData.highBidder;

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

async function placeAuctionBid() {
  // Reads correct ID from index.html without throwing null error
  const bidInput = document.getElementById('bid-input-amount');
  if (!bidInput) return;

  const bidAmount = parseFloat(bidInput.value) || 0;
  const currentHighest = activeAuction ? (activeAuction.highestBid || 750000) : 750000;

  if (bidAmount <= currentHighest) {
    showToast(`Bid must be higher than current bid (Rp ${currentHighest.toLocaleString('id-ID')})`);
    return;
  }

  const modalTitle = document.getElementById('checkout-modal-title');
  if (modalTitle) modalTitle.textContent = `QRIS Payment for Auction Bid (${activeAuction ? activeAuction.cardName : 'Eugene Standard #007'})`;

  const amountDisplay = document.getElementById('qris-amount-display');
  if (amountDisplay) amountDisplay.textContent = `Rp ${bidAmount.toLocaleString('id-ID')}`;

  const qrisImg = document.getElementById('qris-img-element');
  if (qrisImg) qrisImg.src = DEFAULT_QRIS_IMAGE;
  
  const actionBtn = document.getElementById('checkout-action-btn');
  if (actionBtn) actionBtn.setAttribute('onclick', `finalizeAuctionBid(${bidAmount})`);

  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('hidden');
}

async function finalizeAuctionBid(bidAmount) {
  try {
    const bidderName = currentUser ? currentUser.displayName : 'Collector #105';

    await db.collection("auctions").doc("featured_active").update({
      highestBid: bidAmount,
      highBidder: bidderName
    });

    closeCheckoutModal();
    showToast("Bid successfully placed and recorded!");
    fetchActiveAuction();
  } catch (err) {
    console.error("Auction Bid Error:", err);
    // Fallback UI update if firestore doc isn't created yet
    const bidEl = document.getElementById('auction-current-bid');
    if (bidEl) bidEl.textContent = `Rp ${bidAmount.toLocaleString('id-ID')}`;

    const bidderEl = document.getElementById('auction-high-bidder');
    if (bidderEl) bidderEl.textContent = currentUser ? currentUser.displayName : 'You';

    closeCheckoutModal();
    showToast("Bid submitted successfully!");
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
      snapshot.forEach(doc => {
        unreadChatNotifications.push({ id: doc.id, ...doc.data() });
      });

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
      <div onclick="openChatFromNotification('${msg.sender}')" class="p-3 hover:bg-slate-950 cursor-pointer flex items-start gap-2.5 transition-colors">
        <div class="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <i class="fa-solid fa-comment-dots text-xs"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-white truncate">${msg.sender || 'Collector'}</p>
          <p class="text-[11px] text-slate-400 truncate">${msg.text || '[Image / Attachment]'}</p>
          <span class="text-[9px] font-mono text-indigo-400">Click to reply in Inbox</span>
        </div>
      </div>
    `).join('');
  } else {
    badge.classList.add('hidden');
    notifList.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">No new notifications or messages.</div>`;
  }
}

function toggleNotificationMenu() {
  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function openChatFromNotification(senderEmail) {
  toggleNotificationMenu();
  switchTab('inbox');
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

  const myEmail = currentUser ? currentUser.email : 'collector@eugene.com';

  db.collection("messages").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    let messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

    const myMessages = messages.filter(m => m.recipient === myEmail || m.sender === myEmail);

    if (myMessages.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-3xl">No chat conversations yet.</div>`;
      return;
    }

    const threads = {};
    myMessages.forEach(m => {
      const otherUser = m.sender === myEmail ? m.recipient : m.sender;
      if (!threads[otherUser]) threads[otherUser] = m;
    });

    container.innerHTML = Object.keys(threads).map(email => {
      const lastMsg = threads[email];
      return `
        <div class="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 cursor-pointer space-y-2 transition-all">
          <div class="flex items-center gap-2.5">
            <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${email}" class="w-9 h-9 rounded-full border border-slate-800">
            <div>
              <h4 class="text-xs font-bold text-white">${email}</h4>
              <p class="text-[10px] text-slate-400 truncate max-w-[220px]">${lastMsg.text || '[Attachment]'}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }, err => console.error("Inbox load error:", err));
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