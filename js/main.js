// js/main.js

let currentTab = 'catalog';
let currentFilter = 'ALL';
let historyFilter = 'ALL';

// Cart Persisted in LocalStorage
let cart = JSON.parse(localStorage.getItem('eugene_cart') || '[]');

let cardsData = [];
let tradeListings = [];
let tradeRequests = [];
let orderHistory = [];
let userWishlist = JSON.parse(localStorage.getItem('eugene_wishlist') || '[]');
let userProfile = JSON.parse(localStorage.getItem('eugene_profile') || '{"name":"Collector","username":"collector","bio":"Genesis Card Enthusiast","avatar":""}');
let searchDebounceTimer = null;

const DEFAULT_QRIS_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23ffffff'/><rect x='20' y='20' width='60' height='60' fill='%23000000'/><rect x='30' y='30' width='40' height='40' fill='%23ffffff'/><rect x='40' y='40' width='20' height='20' fill='%23000000'/><rect x='120' y='20' width='60' height='60' fill='%23000000'/><rect x='130' y='30' width='40' height='40' fill='%23ffffff'/><rect x='140' y='40' width='20' height='20' fill='%23000000'/><rect x='20' y='120' width='60' height='60' fill='%23000000'/><rect x='30' y='130' width='40' height='40' fill='%23ffffff'/><rect x='40' y='140' width='20' height='20' fill='%23000000'/><text x='100' y='110' font-family='sans-serif' font-size='10' font-weight='bold' text-anchor='middle' fill='%23000000'>OFFICIAL QRIS</text></svg>";

document.addEventListener('DOMContentLoaded', () => {
  setupQrisImage();
  updateCartUI(); // Restore persisted cart
  loadProfileBanner();
  
  fetchInventoryData();
  fetchTradeListings();
  fetchTradeRequests();
  fetchOrderHistory();
  switchTab('catalog');
});

function onAuthResolved(user) {
  if (['admin', 'inventory'].includes(currentTab) && (!user || !isUserAdmin(user.email))) {
    switchTab('catalog');
  }
  updateAdminAuctionControls();
}

// 1. NAVIGATION TAB SWITCHER
function switchTab(tabName) {
  const adminTabs = ['admin', 'inventory'];

  if (adminTabs.includes(tabName)) {
    const userEmail = currentUser ? currentUser.email : null;
    if (!userEmail || !isUserAdmin(userEmail)) {
      showToast("Access Denied: Admin privileges required.");
      tabName = 'catalog';
    }
  }

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

  switch (tabName) {
    case 'catalog': renderCardGrid(); break;
    case 'trade': renderTradeRoom(); break;
    case 'auction': renderAuctionRoom(); break;
    case 'trade-req': renderTradeRequests(); break;
    case 'inbox': loadUserInboxThreads(); break;
    case 'holders': renderHoldersTable(); break;
    case 'history': renderHistoryTable(); break;
    case 'dashboard': renderMyVault(); break;
    case 'wishlist': renderWishlist(); break;
    case 'admin': renderAdminHub(); break;
    case 'inventory': renderInventoryTable(); break;
  }
}

// 2. FIRESTORE SYNC
function fetchInventoryData() {
  db.collection("cards").onSnapshot(snapshot => {
    cardsData = [];
    snapshot.forEach(doc => cardsData.push({ id: doc.id, ...doc.data() }));
    updateRemainingCardsCount();
    if (currentTab === 'catalog') renderCardGrid();
    if (currentTab === 'inventory') renderInventoryTable();
    if (currentTab === 'dashboard') renderMyVault();
    if (currentTab === 'holders') renderHoldersTable();
  }, err => console.error("Error fetching cards:", err));
}

function fetchTradeListings() {
  db.collection("trade_listings").onSnapshot(snapshot => {
    tradeListings = [];
    snapshot.forEach(doc => tradeListings.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'trade') renderTradeRoom();
  }, err => console.error("Error fetching trades:", err));
}

function fetchTradeRequests() {
  db.collection("trade_requests").onSnapshot(snapshot => {
    tradeRequests = [];
    snapshot.forEach(doc => tradeRequests.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'trade-req') renderTradeRequests();
  }, err => console.error("Error fetching trade requests:", err));
}

function fetchOrderHistory() {
  db.collection("orders").onSnapshot(snapshot => {
    orderHistory = [];
    snapshot.forEach(doc => orderHistory.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'history') renderHistoryTable();
    if (currentTab === 'admin') renderAdminHub();
  }, err => console.error("Error fetching order history:", err));
}

// 3. CATALOG GRID & SEARCH
function renderCardGrid() {
  const container = document.getElementById('card-grid');
  if (!container) return;

  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filteredCards = cardsData.filter(card => {
    const matchesFilter = currentFilter === 'ALL' || card.type === currentFilter;
    const matchesSearch = !searchQuery || 
      (card.name && card.name.toLowerCase().includes(searchQuery)) ||
      (card.serial && card.serial.toLowerCase().includes(searchQuery));
    return matchesFilter && matchesSearch;
  });

  if (filteredCards.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No cards found matching your criteria.</div>`;
    return;
  }

  container.innerHTML = filteredCards.map(card => {
    const isPremium = card.type === 'PREMIUM';
    const holoClass = isPremium ? 'card-holo-premium' : 'card-holo-standard';
    const isSaved = userWishlist.includes(card.id);
    
    return `
      <div onclick="openCardDetailModal('${card.id}')" class="${holoClass} rounded-2xl p-3 cursor-pointer flex flex-col justify-between space-y-2 relative group">
        <div class="flex justify-between items-center text-[10px] font-extrabold">
          <span class="px-2 py-0.5 rounded-full ${isPremium ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">${card.type || 'STANDARD'}</span>
          <div class="flex items-center gap-1.5">
            <button onclick="event.stopPropagation(); toggleWishlist('${card.id}')" class="text-xs ${isSaved ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'}">
              <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart"></i>
            </button>
            <span class="font-mono text-slate-400">${card.serial || '*00'}</span>
          </div>
        </div>

        <div class="w-full aspect-[4/5] bg-slate-950/60 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-800">
          <img src="${card.img || 'https://via.placeholder.com/150'}" alt="${card.name}" loading="lazy" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300">
        </div>

        <div>
          <h4 class="text-xs font-black text-white truncate">${card.name || 'Unnamed Card'}</h4>
          <div class="flex justify-between items-center mt-1">
            <span class="text-[11px] font-mono text-emerald-400 font-bold">Rp ${(card.price || 0).toLocaleString('id-ID')}</span>
            <button onclick="event.stopPropagation(); addToCart('${card.id}')" class="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black" title="Add to Cart">
              <i class="fa-solid fa-cart-plus"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function debouncedRenderCardGrid() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => renderCardGrid(), 250);
}

function setFilter(filter) {
  currentFilter = filter;
  ['ALL', 'PREMIUM', 'STANDARD'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    if (btn) {
      btn.className = (f === filter)
        ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 transition-all'
        : 'px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition-all';
    }
  });
  renderCardGrid();
}

function updateRemainingCardsCount() {
  const countEl = document.getElementById('remaining-cards-count');
  if (countEl) {
    const available = cardsData.filter(c => c.status === 'AVAILABLE' || !c.status).length;
    countEl.textContent = available;
  }
}

// 4. TRADE ROOM
function renderTradeRoom() {
  const container = document.getElementById('p2p-listings-grid');
  if (!container) return;

  if (tradeListings.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No active trade listings in the market right now.</div>`;
    return;
  }

  container.innerHTML = tradeListings.map(trade => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
      <div class="flex items-center justify-between text-xs">
        <span class="font-bold text-slate-300"><i class="fa-solid fa-user text-amber-400 mr-1"></i> ${trade.seller || 'Collector'}</span>
        <span class="font-mono text-amber-400 font-bold">${trade.serial || '*00'}</span>
      </div>
      <div class="w-full aspect-square bg-slate-950 rounded-xl overflow-hidden p-2 border border-slate-800 flex items-center justify-center">
        <img src="${trade.img || 'https://via.placeholder.com/150'}" class="max-h-full object-contain">
      </div>
      <div>
        <h4 class="text-xs font-black text-white">${trade.cardName || 'Card Title'}</h4>
        <p class="text-sm font-mono font-bold text-emerald-400 mt-0.5">Rp ${(trade.askingPrice || 0).toLocaleString('id-ID')}</p>
      </div>
      <button onclick="addToCart('${trade.cardId}')" class="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all">
        Buy Listing via QRIS
      </button>
    </div>
  `).join('');
}

// 5. AUCTION ROOM & ADMIN CANCEL AUCTION
function renderAuctionRoom() {
  const featuredCard = cardsData.find(c => c.serial === '*01') || cardsData[0];
  if (!featuredCard) return;

  document.getElementById('auction-card-title').textContent = featuredCard.name || 'Genesis Card';
  document.getElementById('auction-card-serial').textContent = featuredCard.serial || '*01';
  document.getElementById('auction-card-img').src = featuredCard.img || 'https://via.placeholder.com/150';
  document.getElementById('auction-card-owner-info').innerHTML = `Owner: <strong class="text-white">${featuredCard.owner || 'Admin House'}</strong>`;

  updateAdminAuctionControls();

  db.collection("auctions").doc("current_auction").get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('auction-current-bid').textContent = `Rp ${(data.currentBid || 750000).toLocaleString('id-ID')}`;
      document.getElementById('auction-high-bidder').textContent = data.highBidder || 'Collector #104';
      
      const historyContainer = document.getElementById('auction-bid-history');
      if (historyContainer && data.history) {
        historyContainer.innerHTML = data.history.map(b => `
          <div class="flex justify-between items-center p-2 bg-slate-950 rounded-xl border border-slate-800">
            <span class="text-slate-300 font-bold">${b.bidder}</span>
            <span class="font-mono text-emerald-400 font-bold">Rp ${b.amount.toLocaleString('id-ID')}</span>
          </div>
        `).join('');
      }
    }
  });
}

function updateAdminAuctionControls() {
  const container = document.getElementById('admin-auction-controls');
  if (!container) return;
  if (currentUser && isUserAdmin(currentUser.email)) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

async function adminCancelAuction() {
  if (!currentUser || !isUserAdmin(currentUser.email)) {
    showToast("Unauthorized: Only admins can cancel auctions.");
    return;
  }

  try {
    await db.collection("auctions").doc("current_auction").set({
      currentBid: 0,
      highBidder: 'Auction Cancelled',
      history: []
    });
    showToast("Auction successfully cancelled by Admin.");
    renderAuctionRoom();
  } catch (err) {
    console.error("Cancel auction error:", err);
    showToast("Failed to cancel auction.");
  }
}

async function placeAuctionBid() {
  const input = document.getElementById('bid-input-amount');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0) {
    showToast("Please enter a valid bid amount.");
    return;
  }

  const bidderName = currentUser ? (currentUser.displayName || currentUser.email) : 'Guest Collector';

  try {
    const auctionRef = db.collection("auctions").doc("current_auction");
    const doc = await auctionRef.get();
    
    let history = doc.exists && doc.data().history ? doc.data().history : [];
    history.unshift({ bidder: bidderName, amount: amount, timestamp: new Date().toISOString() });

    await auctionRef.set({
      currentBid: amount,
      highBidder: bidderName,
      history: history
    }, { merge: true });

    input.value = '';
    showToast(`Bid placed for Rp ${amount.toLocaleString('id-ID')}!`);
    renderAuctionRoom();
  } catch (err) {
    console.error("Bid Error:", err);
    showToast("Failed to place bid.");
  }
}

// 6. TRADE REQUESTS
function renderTradeRequests() {
  const container = document.getElementById('trade-requests-grid');
  if (!container) return;

  if (tradeRequests.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No active trade proposals found.</div>`;
    return;
  }

  container.innerHTML = tradeRequests.map(req => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div class="flex justify-between items-center text-xs">
        <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">${req.type || 'BUY OFFER'}</span>
        <span class="text-slate-400 font-mono text-[10px]">${new Date(req.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="text-xs space-y-1">
        <p class="text-slate-300"><strong>Proposer:</strong> ${req.proposer || 'Collector'}</p>
        <p class="text-slate-300"><strong>Target Card:</strong> ${req.targetCard || 'Card'}</p>
        <p class="text-slate-400 italic">"${req.notes || 'No notes'}"</p>
      </div>
      <div class="flex gap-2">
        <button onclick="acceptTradeRequest('${req.id}')" class="flex-1 py-1.5 bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl">Accept</button>
        <button onclick="showToast('Counter sent!')" class="flex-1 py-1.5 bg-amber-500 text-slate-950 font-extrabold text-xs rounded-xl">Counter</button>
      </div>
    </div>
  `).join('');
}

async function acceptTradeRequest(reqId) {
  try {
    await db.collection("trade_requests").doc(reqId).delete();
    showToast("Trade request accepted!");
  } catch (err) {
    console.error("Accept error:", err);
  }
}

// 7. INBOX & DIRECT CHAT
function loadUserInboxThreads() {
  const container = document.getElementById('inbox-threads-list');
  if (!container) return;

  const collectors = [...new Set(cardsData.map(c => c.owner).filter(o => o && o !== 'Admin House'))];

  container.innerHTML = `
    <div onclick="openChatDrawer('Admin House')" class="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
          <i class="fa-solid fa-shield-halved text-rose-400 text-sm"></i>
        </div>
        <div>
          <h4 class="text-xs font-bold text-white">Admin Support & Concierge</h4>
          <p class="text-[10px] text-slate-400">Click to send direct inquiries or payment proof...</p>
        </div>
      </div>
      <span class="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/30">Active</span>
    </div>

    ${collectors.map(name => `
      <div onclick="openChatDrawer('${name}')" class="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-amber-500 transition-all">
        <div class="flex items-center gap-3">
          <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${name}" class="w-10 h-10 rounded-full border border-slate-800 bg-slate-950">
          <div>
            <h4 class="text-xs font-bold text-white">${name}</h4>
            <p class="text-[10px] text-slate-400">Click to discuss card trades or offers...</p>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-600 text-xs"></i>
      </div>
    `).join('')}
  `;
}

function searchUsersForChat() {
  const query = (document.getElementById('user-chat-search-input')?.value || '').toLowerCase();
  const resultsContainer = document.getElementById('user-chat-search-results');
  if (!resultsContainer) return;

  if (!query) {
    resultsContainer.classList.add('hidden');
    return;
  }

  const collectors = [...new Set(cardsData.map(c => c.owner).filter(Boolean))];
  const matched = collectors.filter(c => c.toLowerCase().includes(query));

  resultsContainer.classList.remove('hidden');
  resultsContainer.innerHTML = matched.map(name => `
    <div onclick="openChatDrawer('${name}')" class="p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white hover:border-amber-500 cursor-pointer flex justify-between items-center">
      <span>${name}</span>
      <i class="fa-solid fa-comment text-amber-400 text-[10px]"></i>
    </div>
  `).join('');
}

function openChatDrawer(targetUser) {
  document.getElementById('chat-target-user-name').textContent = targetUser || 'Collector';
  document.getElementById('chat-drawer-overlay').classList.remove('hidden');
  document.getElementById('chat-drawer').classList.remove('translate-x-full');
}

function closeChatDrawer() {
  document.getElementById('chat-drawer-overlay').classList.add('hidden');
  document.getElementById('chat-drawer').classList.add('translate-x-full');
}

function sendChatMessage() {
  const input = document.getElementById('chat-text-input');
  if (!input || !input.value.trim()) return;

  const container = document.getElementById('chat-messages-container');
  const msgText = input.value.trim();

  const msgDiv = document.createElement('div');
  msgDiv.className = 'p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs text-amber-200 ml-auto max-w-[80%] text-right';
  msgDiv.textContent = msgText;

  if (container) container.appendChild(msgDiv);
  input.value = '';
  showToast("Message sent!");
}

// 8. CLICKABLE HOLDERS DIRECTORY
function renderHoldersTable() {
  const tbody = document.getElementById('holders-table-body');
  if (!tbody) return;

  const holderMap = {};
  cardsData.forEach(c => {
    const owner = c.owner || 'Admin House';
    if (!holderMap[owner]) holderMap[owner] = [];
    holderMap[owner].push({ serial: c.serial || '*00', cardId: c.id });
  });

  tbody.innerHTML = Object.keys(holderMap).map(owner => `
    <tr onclick="openChatDrawer('${owner}')" class="hover:bg-slate-950 transition-colors cursor-pointer group">
      <td class="p-3 font-bold text-white flex items-center gap-2">
        <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${owner}" class="w-6 h-6 rounded-full border border-slate-800">
        <span class="group-hover:text-amber-400 transition-colors">${owner}</span>
      </td>
      <td class="p-3 font-mono text-amber-400 font-bold">${holderMap[owner].length} cards</td>
      <td class="p-3 font-mono text-slate-400">
        ${holderMap[owner].map(item => `
          <span onclick="event.stopPropagation(); openCardDetailModal('${item.cardId}')" class="inline-block px-1.5 py-0.5 mr-1 mb-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-[10px] font-bold text-slate-300 transition-all">
            ${item.serial}
          </span>
        `).join('')}
      </td>
      <td class="p-3 text-right">
        <button onclick="event.stopPropagation(); openChatDrawer('${owner}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold rounded-lg border border-slate-700">
          <i class="fa-solid fa-comments mr-1"></i> Trade Chat
        </button>
      </td>
    </tr>
  `).join('');
}

// 9. TRANSACTION HISTORY
function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  const userEmail = currentUser ? currentUser.email : '';
  const filteredHistory = orderHistory.filter(o => {
    if (historyFilter === 'MINE') return o.buyerEmail === userEmail;
    if (historyFilter === 'APPROVED') return o.status === 'APPROVED';
    return true;
  });

  if (filteredHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500 text-xs">No transaction records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredHistory.map(o => `
    <tr class="hover:bg-slate-950 transition-colors">
      <td class="p-3.5 font-mono text-amber-400 font-bold">${o.orderRef || '#0000'}</td>
      <td class="p-3.5 text-white">${o.buyerName || 'Guest'}</td>
      <td class="p-3.5 text-slate-300">${o.itemNames || 'Card Stock'}</td>
      <td class="p-3.5 font-mono text-emerald-400 font-bold">Rp ${(o.totalAmount || 0).toLocaleString('id-ID')}</td>
      <td class="p-3.5"><span class="text-[10px] text-slate-400 font-mono">Verified QRIS</span></td>
      <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${o.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${o.status || 'PENDING'}</span></td>
      <td class="p-3.5 text-right text-slate-500 text-[10px]">${new Date(o.createdAt || Date.now()).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

function setHistoryFilter(filter) {
  historyFilter = filter;
  ['ALL', 'MINE', 'APPROVED'].forEach(f => {
    const btn = document.getElementById(`history-filter-${f}`);
    if (btn) {
      btn.className = (f === filter)
        ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 transition-all'
        : 'px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition-all';
    }
  });
  renderHistoryTable();
}

// 10. MY VAULT & PROFILE MANAGEMENT
function loadProfileBanner() {
  document.getElementById('dashboard-banner-name').textContent = userProfile.name || 'Collector';
  document.getElementById('dashboard-banner-username').textContent = `@${userProfile.username || 'collector'}`;
  document.getElementById('dashboard-banner-bio').textContent = userProfile.bio || 'Genesis Card Enthusiast';
  
  if (userProfile.avatar) {
    document.getElementById('dashboard-banner-avatar').src = userProfile.avatar;
  }
}

function openProfileManagerModal() {
  document.getElementById('profile-edit-name-input').value = userProfile.name || '';
  document.getElementById('profile-edit-username-input').value = userProfile.username || '';
  document.getElementById('profile-edit-bio-input').value = userProfile.bio || '';
  document.getElementById('profile-edit-avatar-input').value = userProfile.avatar || '';
  document.getElementById('profile-manager-modal').classList.remove('hidden');
}

function closeProfileManagerModal() {
  document.getElementById('profile-manager-modal').classList.add('hidden');
}

function saveProfileChanges() {
  userProfile = {
    name: document.getElementById('profile-edit-name-input').value || 'Collector',
    username: document.getElementById('profile-edit-username-input').value || 'collector',
    bio: document.getElementById('profile-edit-bio-input').value || 'Collector Bio',
    avatar: document.getElementById('profile-edit-avatar-input').value || ''
  };

  localStorage.setItem('eugene_profile', JSON.stringify(userProfile));
  loadProfileBanner();
  closeProfileManagerModal();
  showToast("Profile settings saved successfully!");
}

function renderMyVault() {
  const container = document.getElementById('owned-cards-grid');
  if (!container) return;

  const myName = userProfile.name || 'Eugene';
  const myCards = cardsData.filter(c => c.owner === myName || c.owner === 'eugene.aquila06');

  if (myCards.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">Your vault is empty. Buy cards from the collection or trade room!</div>`;
    return;
  }

  container.innerHTML = myCards.map(card => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
      <div class="flex justify-between items-center text-[10px]">
        <span class="text-amber-400 font-mono font-bold">${card.serial || '*00'}</span>
        <span class="text-slate-400">${card.type || 'STANDARD'}</span>
      </div>
      <div class="w-full aspect-[4/5] bg-slate-950 rounded-xl overflow-hidden p-1 border border-slate-800 flex items-center justify-center">
        <img src="${card.img || 'https://via.placeholder.com/150'}" class="h-full object-contain">
      </div>
      <h4 class="text-xs font-bold text-white truncate">${card.name}</h4>
      <button onclick="openListCardForTradeModal('${card.id}')" class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-slate-700">
        List for Trade
      </button>
    </div>
  `).join('');
}

// 11. WISHLIST VIEW
function toggleWishlist(cardId) {
  if (userWishlist.includes(cardId)) {
    userWishlist = userWishlist.filter(id => id !== cardId);
    showToast("Removed from Wishlist.");
  } else {
    userWishlist.push(cardId);
    showToast("Added to Wishlist!");
  }
  localStorage.setItem('eugene_wishlist', JSON.stringify(userWishlist));
  renderCardGrid();
  if (currentTab === 'wishlist') renderWishlist();
}

function clearWishlist() {
  userWishlist = [];
  localStorage.setItem('eugene_wishlist', JSON.stringify([]));
  renderWishlist();
  showToast("Wishlist cleared.");
}

function renderWishlist() {
  const container = document.getElementById('wishlist-page-grid');
  if (!container) return;

  const savedCards = cardsData.filter(c => userWishlist.includes(c.id));

  if (savedCards.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No saved cards in your wishlist yet.</div>`;
    return;
  }

  container.innerHTML = savedCards.map(card => `
    <div onclick="openCardDetailModal('${card.id}')" class="card-holo-standard rounded-2xl p-3 cursor-pointer space-y-2">
      <div class="flex justify-between text-[10px] font-mono text-amber-400">
        <span>${card.serial || '*00'}</span>
        <button onclick="event.stopPropagation(); toggleWishlist('${card.id}')" class="text-rose-500"><i class="fa-solid fa-heart"></i></button>
      </div>
      <div class="w-full aspect-[4/5] bg-slate-950 rounded-xl p-1 overflow-hidden flex items-center justify-center">
        <img src="${card.img || 'https://via.placeholder.com/150'}" class="h-full object-contain">
      </div>
      <h4 class="text-xs font-bold text-white truncate">${card.name}</h4>
    </div>
  `).join('');
}

// 12. ADMIN HUB & PERSONA SWITCHER
function renderAdminHub() {
  const container = document.getElementById('admin-pending-orders-list');
  if (!container) return;

  const pendingOrders = orderHistory.filter(o => o.status === 'PENDING');

  if (pendingOrders.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 py-4">No pending transactions requiring approval.</p>`;
    return;
  }

  container.innerHTML = pendingOrders.map(o => `
    <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
      <div>
        <span class="font-mono text-amber-400 font-bold">${o.orderRef || '#000'}</span>
        <p class="text-white font-bold">${o.buyerName || 'Buyer'}</p>
        <p class="text-emerald-400 font-mono">Rp ${(o.totalAmount || 0).toLocaleString('id-ID')}</p>
      </div>
      <button onclick="approveOrder('${o.id}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl">
        Approve Payment
      </button>
    </div>
  `).join('');
}

async function approveOrder(orderId) {
  try {
    await db.collection("orders").doc(orderId).update({ status: 'APPROVED' });
    showToast("Order approved successfully!");
  } catch (err) {
    console.error("Approve Error:", err);
    showToast("Failed to approve order.");
  }
}

function refreshAdminHub() {
  fetchOrderHistory();
  showToast("Refreshed admin records.");
}

function switchAccountPersona(emailPersona) {
  if (currentUser) {
    currentUser = { ...currentUser, email: emailPersona };
  } else {
    currentUser = { email: emailPersona, displayName: 'Test Persona' };
  }
  
  if (typeof updateAuthUI === 'function') updateAuthUI(currentUser);
  showToast(`Switched active persona to: ${emailPersona}`);
  if (currentTab === 'admin' || currentTab === 'inventory') switchTab('catalog');
}

// 13. FULL INVENTORY MANAGEMENT (ADMIN)
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const search = (document.getElementById('inventory-search')?.value || '').toLowerCase();

  const items = cardsData.filter(c => 
    !search || 
    (c.name && c.name.toLowerCase().includes(search)) || 
    (c.serial && c.serial.toLowerCase().includes(search)) || 
    (c.owner && c.owner.toLowerCase().includes(search))
  );

  tbody.innerHTML = items.map(c => `
    <tr class="hover:bg-slate-950 transition-colors">
      <td class="p-3 font-mono text-amber-400 font-bold">${c.serial || '*00'}</td>
      <td class="p-3 font-bold text-white">${c.name || 'Unnamed'}</td>
      <td class="p-3 text-slate-400">${c.type || 'STANDARD'}</td>
      <td class="p-3 font-mono">Rp ${(c.price || 0).toLocaleString('id-ID')}</td>
      <td class="p-3 text-slate-300">${c.owner || 'Admin House'}</td>
      <td class="p-3"><span class="px-2 py-0.5 text-[10px] font-bold rounded ${c.status === 'SOLD' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">${c.status || 'AVAILABLE'}</span></td>
      <td class="p-3 text-right">
        <button onclick="openEditInventoryModal('${c.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[10px] font-bold border border-slate-700">Edit Full Attributes</button>
      </td>
    </tr>
  `).join('');
}

function openEditInventoryModal(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-name').value = card.name || '';
  document.getElementById('edit-card-serial').value = card.serial || '';
  document.getElementById('edit-card-type').value = card.type || 'STANDARD';
  document.getElementById('edit-card-edition').value = card.edition || '';
  document.getElementById('edit-card-sn').value = card.sn || '';
  document.getElementById('edit-card-tier').value = card.tier || '';
  document.getElementById('edit-card-printing').value = card.printing || '';
  document.getElementById('edit-card-price').value = card.price || 0;
  document.getElementById('edit-card-status').value = card.status || 'AVAILABLE';
  document.getElementById('edit-card-owner').value = card.owner || '';
  document.getElementById('edit-card-img').value = card.img || '';

  document.getElementById('inventory-edit-modal').classList.remove('hidden');
}

function closeInventoryModal() {
  document.getElementById('inventory-edit-modal').classList.add('hidden');
}

async function saveInventoryCardChanges() {
  const id = document.getElementById('edit-card-id').value;
  if (!id) return;

  const updatedData = {
    name: document.getElementById('edit-card-name').value,
    serial: document.getElementById('edit-card-serial').value,
    type: document.getElementById('edit-card-type').value,
    edition: document.getElementById('edit-card-edition').value,
    sn: document.getElementById('edit-card-sn').value,
    tier: document.getElementById('edit-card-tier').value,
    printing: document.getElementById('edit-card-printing').value,
    price: parseFloat(document.getElementById('edit-card-price').value) || 0,
    status: document.getElementById('edit-card-status').value,
    owner: document.getElementById('edit-card-owner').value,
    img: document.getElementById('edit-card-img').value
  };

  try {
    await db.collection("cards").doc(id).update(updatedData);
    closeInventoryModal();
    showToast("Full card attributes updated successfully!");
  } catch (err) {
    console.error("Save Error:", err);
    showToast("Failed to update card attributes.");
  }
}

// 14. PERSISTED SHOPPING CART & QRIS
function addToCart(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  if (cart.some(item => item.id === cardId)) {
    showToast("Card is already in your cart.");
    return;
  }

  cart.push(card);
  saveCartState();
  updateCartUI();
  showToast(`Added "${card.name}" to cart.`);
}

function removeFromCart(cardId) {
  cart = cart.filter(item => item.id !== cardId);
  saveCartState();
  updateCartUI();
}

function saveCartState() {
  localStorage.setItem('eugene_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const badge = document.getElementById('cart-badge-count');
  if (badge) badge.textContent = cart.length;

  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-slate-500 text-xs">Your cart is currently empty.</div>`;
    document.getElementById('cart-subtotal').textContent = 'Rp 0';
    document.getElementById('cart-tax').textContent = 'Rp 0';
    document.getElementById('cart-grand-total').textContent = 'Rp 0';
    return;
  }

  let subtotal = 0;
  container.innerHTML = cart.map(item => {
    subtotal += item.price || 0;
    return `
      <div class="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
        <div class="flex items-center gap-3">
          <img src="${item.img || 'https://via.placeholder.com/50'}" class="w-10 h-10 object-contain rounded bg-slate-900 border border-slate-800">
          <div>
            <h5 class="text-xs font-bold text-white">${item.name}</h5>
            <span class="text-[10px] font-mono text-amber-400 font-bold">Rp ${(item.price || 0).toLocaleString('id-ID')}</span>
          </div>
        </div>
        <button onclick="removeFromCart('${item.id}')" class="text-slate-500 hover:text-rose-400 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  }).join('');

  const tax = Math.round(subtotal * 0.02);
  const grandTotal = subtotal + tax;

  document.getElementById('cart-subtotal').textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
  document.getElementById('cart-tax').textContent = `Rp ${tax.toLocaleString('id-ID')}`;
  document.getElementById('cart-grand-total').textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
}

function toggleCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const drawer = document.getElementById('cart-drawer');
  if (!overlay || !drawer) return;

  if (drawer.classList.contains('translate-x-full')) {
    overlay.classList.remove('hidden');
    drawer.classList.remove('translate-x-full');
  } else {
    overlay.classList.add('hidden');
    drawer.classList.add('translate-x-full');
  }
}

function proceedToCheckout() {
  if (cart.length === 0) {
    showToast("Cart is empty.");
    return;
  }

  toggleCartDrawer();

  let subtotal = cart.reduce((sum, item) => sum + (item.price || 0), 0);
  let total = subtotal + Math.round(subtotal * 0.02);

  document.getElementById('qris-amount-display').textContent = `Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function submitOrderWithProof() {
  if (cart.length === 0) return;

  let subtotal = cart.reduce((sum, item) => sum + (item.price || 0), 0);
  let grandTotal = subtotal + Math.round(subtotal * 0.02);

  const orderData = {
    orderRef: '#EC-' + Math.floor(100000 + Math.random() * 900000),
    buyerName: currentUser ? (currentUser.displayName || currentUser.email) : 'Guest Collector',
    buyerEmail: currentUser ? currentUser.email : 'guest@eugenecard.com',
    itemNames: cart.map(i => i.name).join(', '),
    totalAmount: grandTotal,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  try {
    await db.collection("orders").add(orderData);
    cart = [];
    saveCartState();
    updateCartUI();
    closeCheckoutModal();
    showToast("QRIS Order submitted for approval!");
    switchTab('history');
  } catch (err) {
    console.error("Order Submit Error:", err);
    showToast("Failed to submit order.");
  }
}

// 15. MODAL HELPERS & UTILITIES
function openCardDetailModal(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('detail-card-title').textContent = card.name || 'Unnamed Card';
  document.getElementById('detail-card-serial').textContent = card.serial || '*00';
  document.getElementById('detail-card-img').src = card.img || 'https://via.placeholder.com/150';
  document.getElementById('detail-card-edition-badge').textContent = card.type || 'STANDARD';
  document.getElementById('detail-card-edition-text').textContent = card.edition || 'Beta Edition';
  document.getElementById('detail-card-sn-text').textContent = card.sn || '0000';
  document.getElementById('detail-card-tier-text').textContent = card.tier || '100';
  document.getElementById('detail-card-printing-text').textContent = card.printing || '1x';
  document.getElementById('detail-card-owner').textContent = card.owner || 'Unowned (House)';
  document.getElementById('detail-card-price').textContent = `Rp ${(card.price || 0).toLocaleString('id-ID')}`;
  document.getElementById('detail-card-status').textContent = card.status || 'AVAILABLE';

  const actionContainer = document.getElementById('detail-card-action-container');
  if (actionContainer) {
    actionContainer.innerHTML = `
      <button onclick="addToCart('${card.id}'); closeCardDetailModal()" class="w-full py-3 bg-amber-500 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-400 shadow-lg transition-all flex items-center justify-center gap-2">
        <i class="fa-solid fa-cart-shopping"></i> Add Card to Cart
      </button>
    `;
  }

  document.getElementById('card-detail-modal').classList.remove('hidden');
}

function closeCardDetailModal() {
  document.getElementById('card-detail-modal').classList.add('hidden');
}

function openListCardForTradeModal(cardId = '') {
  document.getElementById('list-card-id-target').value = cardId;
  document.getElementById('list-card-modal').classList.remove('hidden');
}

function closeListCardModal() {
  document.getElementById('list-card-modal').classList.add('hidden');
}

async function submitCardListing() {
  const cardId = document.getElementById('list-card-id-target').value;
  const price = parseFloat(document.getElementById('list-card-price-input').value) || 0;
  
  if (!cardId) {
    showToast("Please select a valid card.");
    return;
  }

  const card = cardsData.find(c => c.id === cardId);
  try {
    await db.collection("trade_listings").add({
      cardId: cardId,
      cardName: card ? card.name : 'Card',
      serial: card ? card.serial : '*00',
      img: card ? card.img : '',
      askingPrice: price,
      seller: currentUser ? (currentUser.displayName || currentUser.email) : 'Collector',
      createdAt: new Date().toISOString()
    });

    closeListCardModal();
    showToast("Listing published to Trading Room!");
  } catch (err) {
    console.error("Listing error:", err);
  }
}

function openProposeTradeModal() {
  document.getElementById('propose-trade-modal').classList.remove('hidden');
}

function closeProposeTradeModal() {
  document.getElementById('propose-trade-modal').classList.add('hidden');
}

async function submitTradeProposal() {
  const targetSerial = document.getElementById('trade-target-serial-input').value;
  const notes = document.getElementById('trade-notes-input').value;

  try {
    await db.collection("trade_requests").add({
      targetCard: targetSerial,
      notes: notes,
      proposer: currentUser ? (currentUser.displayName || currentUser.email) : 'Collector',
      type: 'BUY OFFER',
      createdAt: new Date().toISOString()
    });

    closeProposeTradeModal();
    showToast("Trade proposal submitted!");
  } catch (err) {
    console.error("Proposal error:", err);
  }
}

function setupQrisImage() {
  const qrisImg = document.getElementById('qris-img-element');
  if (qrisImg) qrisImg.src = DEFAULT_QRIS_IMAGE;
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