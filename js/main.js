// js/main.js

let currentTab = 'catalog';
let currentFilter = 'ALL';
let historyFilter = 'ALL';

let cart = JSON.parse(localStorage.getItem('eugene_cart') || '[]');

let cardsData = [];
let tradeListings = [];
let tradeRequests = [];
let orderHistory = [];
let allUsersList = [];
let activeAuction = null;
let auctionTimerInterval = null;
let userWishlist = JSON.parse(localStorage.getItem('eugene_wishlist') || '[]');
let userProfile = JSON.parse(localStorage.getItem('eugene_profile') || '{"name":"Collector","username":"collector","bio":"Genesis Card Enthusiast","avatar":"","instagram":"","tiktok":"","website":""}');
let searchDebounceTimer = null;
let activeChatRecipient = null;
let currentChatScreenshotBase64 = null;

// Official Hosted Eugene Card QRIS Image URL
const DEFAULT_QRIS_IMAGE = "https://iili.io/CekvjN2.png";

document.addEventListener('DOMContentLoaded', () => {
  setupQrisImage();
  updateCartUI();
  loadProfileBanner();
  
  fetchInventoryData();
  fetchTradeListings();
  fetchTradeRequests();
  fetchOrderHistory();
  fetchAllUsers();
  fetchActiveAuction();
  fetchUnreadInboxCount();
  switchTab('catalog');
});

function onAuthResolved(user) {
  if (['admin', 'inventory'].includes(currentTab) && (!user || !isUserAdmin(user.email))) {
    switchTab('catalog');
  }
  updateAdminAuctionControls();
  fetchUnreadInboxCount();
  fetchAllUsers();
}

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

function fetchInventoryData() {
  db.collection("cards").onSnapshot(snapshot => {
    cardsData = [];
    snapshot.forEach(doc => cardsData.push({ id: doc.id, ...doc.data() }));
    updateRemainingCardsCount();
    if (currentTab === 'catalog') renderCardGrid();
    if (currentTab === 'inventory') renderInventoryTable();
    if (currentTab === 'dashboard') renderMyVault();
    if (currentTab === 'holders') renderHoldersTable();
    if (currentTab === 'admin') renderAdminHub();
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

function fetchAllUsers() {
  db.collection("users").onSnapshot(snapshot => {
    allUsersList = [];
    snapshot.forEach(doc => allUsersList.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'admin') renderAdminHub();
  }, err => console.error("Error fetching users:", err));
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

  if (!activeAuction || activeAuction.status !== 'ACTIVE') {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto py-16 text-center space-y-4">
        <div class="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-500 text-xl mx-auto">
          <i class="fa-solid fa-gavel"></i>
        </div>
        <h3 class="text-base font-black text-white">No Active Auctions</h3>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">There are currently no cards listed in the auction room. Go to your Vault and put a card up for auction to start one!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div class="flex justify-between items-center">
          <span class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">FEATURED AUCTION</span>
          <span id="auction-countdown-badge" class="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800"><i class="fa-solid fa-clock text-amber-400 mr-1"></i> <span id="auction-timer-display">Calculating...</span></span>
        </div>
        <h2 class="text-lg font-black text-white">${activeAuction.cardName || 'Auction Card'}</h2>
        
        <div class="w-full aspect-[4/3] bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center p-4">
          <img src="${activeAuction.imgUrl || activeAuction.img || 'https://via.placeholder.com/250'}" class="max-h-full object-contain">
        </div>

        <div class="flex justify-between items-center text-xs text-slate-300 pt-2">
          <span>Serial: <strong class="text-amber-400 font-mono">${activeAuction.serial || '*0001'}</strong></span>
          <span>Owner: <strong class="text-white">${activeAuction.owner || 'Collector'}</strong></span>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between shadow-xl">
        <div class="space-y-4">
          <h3 class="text-xs font-black text-slate-400 uppercase tracking-wider">Current Highest Bid</h3>
          <div class="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
            <p class="text-2xl font-mono font-black text-emerald-400">Rp ${(activeAuction.highestBid || activeAuction.startingBid || 0).toLocaleString('id-ID')}</p>
            <p class="text-[10px] text-slate-400">High Bidder: <strong class="text-white">${activeAuction.highBidder || 'None'}</strong></p>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-bold text-slate-300">Your Bid Amount (IDR)</label>
            <input type="number" id="auction-bid-input" placeholder="e.g. 150000" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500">
            <button onclick="placeAuctionBid()" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition-all">
              Place Bid via QRIS
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  startLiveAuctionCountdown(activeAuction.expiresAt);
}

function startLiveAuctionCountdown(expiresAtString) {
  const timerDisplay = document.getElementById('auction-timer-display');
  if (!timerDisplay) return;

  const targetTime = new Date(expiresAtString || Date.now() + 86400000).getTime();

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
  const bidInput = document.getElementById('auction-bid-input');
  const bidAmount = parseFloat(bidInput.value) || 0;
  const currentHighest = activeAuction.highestBid || activeAuction.startingBid || 0;

  if (bidAmount <= currentHighest) {
    showToast(`Bid must be higher than current bid (Rp ${currentHighest.toLocaleString('id-ID')})`);
    return;
  }

  document.getElementById('qris-amount-display').textContent = `Rp ${bidAmount.toLocaleString('id-ID')}`;
  document.getElementById('checkout-modal-title').textContent = `QRIS Payment for Auction Bid (${activeAuction.cardName})`;
  document.getElementById('qris-img-element').src = DEFAULT_QRIS_IMAGE;
  
  const actionBtn = document.getElementById('checkout-action-btn');
  actionBtn.setAttribute('onclick', `finalizeAuctionBid(${bidAmount})`);
  document.getElementById('checkout-modal').classList.remove('hidden');
}

async function finalizeAuctionBid(bidAmount) {
  try {
    const bidderName = userProfile.name || (currentUser ? currentUser.displayName : 'Collector');
    await db.collection("auctions").doc("featured_active").update({
      highestBid: bidAmount,
      highBidder: bidderName
    });

    closeCheckoutModal();
    showToast("Bid successfully placed and recorded!");
    fetchActiveAuction();
  } catch (err) {
    console.error("Auction Bid Error:", err);
    showToast("Failed to submit bid.");
  }
}

function fetchUnreadInboxCount() {
  const userEmail = currentUser ? currentUser.email : 'collector@eugene.com';
  db.collection("messages").where("recipient", "==", userEmail).where("read", "==", false).onSnapshot(snapshot => {
    const count = snapshot.size;
    const badge = document.getElementById('inbox-badge-count');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }, err => console.error("Error fetching unread messages:", err));
}

function openCardDetailModal(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('detail-card-title').textContent = card.name || 'Card Title';
  document.getElementById('detail-card-serial').textContent = card.serial || '*0001';
  document.getElementById('detail-card-type').textContent = card.type || 'STANDARD';
  document.getElementById('detail-card-owner').innerHTML = `Owner: <strong class="text-white">${card.owner || 'Admin House'}</strong>`;
  document.getElementById('detail-card-edition').textContent = card.edition || 'Beta Edition';
  document.getElementById('detail-card-sn').textContent = card.sn || '0001';
  document.getElementById('detail-card-tier').textContent = card.tier || '100';
  document.getElementById('detail-card-price').textContent = `Rp ${(card.price || card.baseFloorPrice || 100000).toLocaleString('id-ID')}`;
  document.getElementById('detail-card-img').src = card.imgUrl || card.img || 'https://via.placeholder.com/200x250';

  const cartBtn = document.getElementById('detail-cart-btn');
  cartBtn.setAttribute('onclick', `addToCart('${card.id}'); closeCardDetailModal();`);

  document.getElementById('card-detail-modal').classList.remove('hidden');
}

function closeCardDetailModal() {
  document.getElementById('card-detail-modal').classList.add('hidden');
}

function renderCardGrid() {
  const container = document.getElementById('card-grid');
  if (!container) return;

  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filteredCards = cardsData.filter(card => {
    const cardType = card.type || 'STANDARD';
    const matchesFilter = currentFilter === 'ALL' || cardType === currentFilter;
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
    const isSaved = Array.isArray(userWishlist) && userWishlist.includes(card.id);
    const cardPrice = card.price || card.baseFloorPrice || 0;
    const cardImg = card.imgUrl || card.img || 'https://via.placeholder.com/150';
    
    return `
      <div onclick="openCardDetailModal('${card.id}')" class="${holoClass} rounded-2xl p-3 cursor-pointer flex flex-col justify-between space-y-2 relative group hover:border-amber-500/50 transition-all">
        <div class="flex justify-between items-center text-[10px] font-extrabold">
          <span class="px-2 py-0.5 rounded-full ${isPremium ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">
            ${card.type || 'STANDARD'}
          </span>
          <div class="flex items-center gap-1.5">
            <button onclick="event.stopPropagation(); toggleWishlist('${card.id}')" class="text-xs ${isSaved ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'}">
              <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart"></i>
            </button>
            <span class="font-mono text-slate-400">${card.serial || '*0001'}</span>
          </div>
        </div>

        <div class="w-full aspect-[4/5] bg-slate-950/60 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-800">
          <img src="${cardImg}" alt="${card.name || 'Card'}" loading="lazy" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300">
        </div>

        <div>
          <h4 class="text-xs font-black text-white truncate">${card.name || 'Unnamed Card'}</h4>
          <div class="flex justify-between items-center mt-1">
            <span class="text-[11px] font-mono text-emerald-400 font-bold">Rp ${cardPrice.toLocaleString('id-ID')}</span>
            <button onclick="event.stopPropagation(); addToCart('${card.id}')" class="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black shadow" title="Add to Cart">
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
    countEl.textContent = available > 0 ? available : 50;
  }
}

function openListCardForTradeModal() {
  const select = document.getElementById('list-card-select');
  if (!select) return;

  const myName = userProfile.name || (currentUser ? currentUser.displayName : 'Collector');
  const myCards = cardsData.filter(c => c.owner === myName || c.owner === (currentUser ? currentUser.email : ''));

  if (myCards.length === 0) {
    showToast("You don't own any cards in your vault to list yet!");
    return;
  }

  select.innerHTML = myCards.map(c => `
    <option value="${c.id}">${c.name} (${c.serial}) - Rp ${(c.price || c.baseFloorPrice || 100000).toLocaleString('id-ID')}</option>
  `).join('');

  document.getElementById('list-card-price-input').value = myCards[0].price || myCards[0].baseFloorPrice || 100000;
  document.getElementById('list-card-trade-modal').classList.remove('hidden');
}

function closeListCardTradeModal() {
  document.getElementById('list-card-trade-modal').classList.add('hidden');
}

async function submitListCardToTrade() {
  const cardId = document.getElementById('list-card-select').value;
  const askingPrice = parseFloat(document.getElementById('list-card-price-input').value) || 100000;
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  const listingPayload = {
    cardId: card.id,
    cardName: card.name,
    serial: card.serial,
    imgUrl: card.imgUrl || card.img || '',
    askingPrice: askingPrice,
    seller: userProfile.name || (currentUser ? currentUser.displayName : 'Collector'),
    sellerEmail: currentUser ? currentUser.email : 'collector@eugene.com',
    createdAt: new Date().toISOString()
  };

  try {
    await db.collection("trade_listings").add(listingPayload);
    closeListCardTradeModal();
    showToast("Card listed successfully in Trading Room!");
    switchTab('trade');
  } catch (err) {
    console.error("List Card Error:", err);
    showToast("Failed to list card.");
  }
}

async function cancelTradeListing(listingId) {
  if (!confirm("Are you sure you want to cancel this trade listing?")) return;
  try {
    await db.collection("trade_listings").doc(listingId).delete();
    showToast("Trade listing cancelled and removed from market.");
  } catch (err) {
    console.error("Cancel listing error:", err);
    showToast("Failed to cancel listing.");
  }
}

function renderTradeRoom() {
  const container = document.getElementById('p2p-listings-grid');
  if (!container) return;

  if (tradeListings.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No active trade listings in the market right now.</div>`;
    return;
  }

  const myEmail = currentUser ? currentUser.email : 'collector@eugene.com';
  const myName = userProfile.name || 'Collector';

  container.innerHTML = tradeListings.map(trade => {
    const isMyListing = trade.sellerEmail === myEmail || trade.seller === myName || (currentUser && isUserAdmin(currentUser.email));
    const tradeImg = trade.imgUrl || trade.img || 'https://via.placeholder.com/150';

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg relative">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-300"><i class="fa-solid fa-user text-amber-400 mr-1"></i> ${trade.seller || 'Collector'}</span>
          <span class="font-mono text-amber-400 font-bold">${trade.serial || '*0001'}</span>
        </div>
        <div class="w-full aspect-square bg-slate-950 rounded-xl overflow-hidden p-2 border border-slate-800 flex items-center justify-center">
          <img src="${tradeImg}" class="max-h-full object-contain">
        </div>
        <div>
          <h4 class="text-xs font-black text-white">${trade.cardName || 'Card Title'}</h4>
          <p class="text-sm font-mono font-bold text-emerald-400 mt-0.5">Rp ${(trade.askingPrice || 0).toLocaleString('id-ID')}</p>
        </div>

        <div class="flex gap-2 pt-1">
          <button onclick="addToCart('${trade.cardId}')" class="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all">
            Buy via QRIS
          </button>
          ${isMyListing ? `
            <button onclick="cancelTradeListing('${trade.id}')" class="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-xs rounded-xl border border-rose-500/30" title="Cancel Listing">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderHoldersTable() {
  const tbody = document.getElementById('holders-table-body');
  if (!tbody) return;

  const holderMap = {};
  cardsData.forEach(c => {
    const owner = c.owner || 'Admin House';
    if (!holderMap[owner]) holderMap[owner] = [];
    holderMap[owner].push(c);
  });

  tbody.innerHTML = Object.keys(holderMap).map(owner => `
    <tr onclick="openOwnerVaultModal('${owner}')" class="hover:bg-slate-950 transition-colors cursor-pointer group">
      <td class="p-3 font-bold text-white flex items-center gap-2">
        <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${owner}" class="w-6 h-6 rounded-full border border-slate-800">
        <span class="group-hover:text-amber-400 transition-colors">${owner}</span>
      </td>
      <td class="p-3 font-mono text-amber-400 font-bold">${holderMap[owner].length} cards</td>
      <td class="p-3 font-mono text-slate-400">
        ${holderMap[owner].map(card => `
          <button onclick="event.stopPropagation(); openOfferModalForCard('${card.id}')" class="inline-block px-1.5 py-0.5 mr-1 mb-1 rounded bg-slate-800 hover:bg-purple-600 hover:text-white text-[10px] font-bold text-amber-400 border border-slate-700 transition-all" title="Propose Offer on ${card.serial}">
            ${card.serial} (Offer)
          </button>
        `).join('')}
      </td>
      <td class="p-3 text-right">
        <button onclick="event.stopPropagation(); openOwnerVaultModal('${owner}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold rounded-lg border border-slate-700">
          <i class="fa-solid fa-vault mr-1"></i> Open Binder
        </button>
      </td>
    </tr>
  `).join('');
}

function openOwnerVaultModal(ownerName) {
  const cards = cardsData.filter(c => (c.owner || 'Admin House') === ownerName);

  document.getElementById('owner-vault-name').textContent = `${ownerName}'s Vault`;
  document.getElementById('owner-vault-count').textContent = `${cards.length} Cards Held`;
  document.getElementById('owner-vault-avatar').src = `https://api.dicebear.com/7.x/identicon/svg?seed=${ownerName}`;

  const grid = document.getElementById('owner-vault-cards-grid');
  grid.innerHTML = cards.map(card => `
    <div class="bg-slate-950 border border-slate-800 rounded-2xl p-2.5 space-y-2 text-center">
      <div class="w-full aspect-[4/5] bg-slate-900 rounded-xl p-1 overflow-hidden flex items-center justify-center">
        <img src="${card.imgUrl || card.img || 'https://via.placeholder.com/150'}" class="h-full object-contain">
      </div>
      <p class="text-xs font-bold text-white truncate">${card.name}</p>
      <p class="text-[10px] font-mono text-amber-400 font-bold">${card.serial || '*0001'}</p>
      <button onclick="closeOwnerVaultModal(); openOfferModalForCard('${card.id}')" class="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-extrabold rounded-xl transition-all">
        Propose Offer
      </button>
    </div>
  `).join('');

  document.getElementById('owner-vault-modal').classList.remove('hidden');
}

function closeOwnerVaultModal() {
  document.getElementById('owner-vault-modal').classList.add('hidden');
}

function openOfferModalForCard(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('trade-target-serial-input').value = card.serial || '';
  document.getElementById('trade-notes-input').value = `Offer for ${card.name}`;
  
  const modal = document.getElementById('propose-trade-modal');
  if (modal) {
    modal.setAttribute('data-target-card-id', card.id);
    modal.setAttribute('data-target-owner', card.owner || 'Admin House');
  }

  openProposeTradeModal();
}

function openProposeTradeModal() {
  document.getElementById('propose-trade-modal').classList.remove('hidden');
}

function closeProposeTradeModal() {
  document.getElementById('propose-trade-modal').classList.add('hidden');
}

async function submitTradeProposal() {
  const modal = document.getElementById('propose-trade-modal');
  const targetSerial = document.getElementById('trade-target-serial-input').value;
  const notes = document.getElementById('trade-notes-input').value;
  const offerAmount = parseFloat(document.getElementById('trade-offer-amount-input')?.value || 100000);

  const card = cardsData.find(c => c.serial === targetSerial || c.id === modal.getAttribute('data-target-card-id'));
  const cardOwner = card ? card.owner : (modal.getAttribute('data-target-owner') || 'Admin House');

  const tradePayload = {
    targetCard: targetSerial || (card ? card.name : 'Card'),
    targetCardId: card ? card.id : '',
    targetOwner: cardOwner,
    proposer: userProfile.name || (currentUser ? currentUser.displayName : 'Collector'),
    proposerEmail: currentUser ? currentUser.email : 'collector@eugene.com',
    notes: notes || 'Direct offer on card',
    offerAmount: offerAmount,
    status: 'BUY OFFER',
    createdAt: new Date().toISOString()
  };

  try {
    await db.collection("trade_requests").add(tradePayload);
    closeProposeTradeModal();
    showToast(`Trade offer sent to ${cardOwner}!`);
    switchTab('trade-req');
  } catch (err) {
    console.error("Proposal Submission Error:", err);
    showToast("Failed to submit trade offer.");
  }
}

function renderTradeRequests() {
  const container = document.getElementById('trade-requests-grid');
  if (!container) return;

  if (tradeRequests.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No active trade proposals found.</div>`;
    return;
  }

  container.innerHTML = tradeRequests.map(req => {
    const isCountered = req.status === 'COUNTERED';

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex justify-between items-center text-xs">
          <span class="px-2 py-0.5 rounded ${isCountered ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'} font-bold">
            ${req.status || 'BUY OFFER'}
          </span>
          <span class="text-slate-400 font-mono text-[10px]">${new Date(req.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>

        <div class="text-xs space-y-1">
          <p class="text-slate-300"><strong>Proposer:</strong> ${req.proposer || 'Collector'}</p>
          <p class="text-slate-300"><strong>Target Card:</strong> ${req.targetCard || 'Card'}</p>
          <p class="text-emerald-400 font-mono font-bold">Offer: Rp ${(req.offerAmount || 0).toLocaleString('id-ID')}</p>
          ${isCountered ? `<p class="text-amber-400 font-mono font-bold">Counter: Rp ${(req.counterAmount || 0).toLocaleString('id-ID')}</p>` : ''}
          <p class="text-slate-400 italic">"${req.notes || 'No details'}"</p>
        </div>

        <div class="flex gap-2 pt-1">
          <button onclick="acceptTradeOffer('${req.id}')" class="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl">Accept Offer</button>
          <button onclick="openCounterOfferModal('${req.id}')" class="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl">Counter Offer</button>
          <button onclick="declineTradeOffer('${req.id}')" class="flex-1 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-extrabold text-xs rounded-xl border border-rose-500/30">Decline Offer</button>
        </div>
      </div>
    `;
  }).join('');
}

async function acceptTradeOffer(reqId) {
  const req = tradeRequests.find(r => r.id === reqId);
  if (!req) return;

  const totalAmount = req.offerAmount || 100000;

  document.getElementById('qris-amount-display').textContent = `Rp ${totalAmount.toLocaleString('id-ID')}`;
  document.getElementById('checkout-modal-title').textContent = `QRIS Payment for Accepted Offer (${req.targetCard})`;
  document.getElementById('qris-img-element').src = DEFAULT_QRIS_IMAGE;
  
  const actionBtn = document.getElementById('checkout-action-btn');
  actionBtn.setAttribute('onclick', `finalizeAcceptedOffer('${reqId}')`);
  document.getElementById('checkout-modal').classList.remove('hidden');
}

async function finalizeAcceptedOffer(reqId) {
  const req = tradeRequests.find(r => r.id === reqId);
  if (!req) return;

  try {
    await db.collection("trade_requests").doc(reqId).update({ status: 'ACCEPTED & PAID' });

    if (req.targetCardId) {
      await db.collection("cards").doc(req.targetCardId).update({
        owner: req.proposer || 'Collector'
      });
    } else {
      const matchingCard = cardsData.find(c => c.serial === req.targetCard);
      if (matchingCard) {
        await db.collection("cards").doc(matchingCard.id).update({
          owner: req.proposer || 'Collector'
        });
      }
    }

    const buyerEmail = currentUser ? currentUser.email : (req.proposerEmail || 'collector@eugene.com');
    const adminEmail = 'eugene.aquila06@gmail.com';
    
    await db.collection("messages").add({
      sender: buyerEmail,
      recipient: adminEmail,
      text: `Automated Notice: Trade offer for card ${req.targetCard} was accepted and paid successfully via QRIS (Rp ${(req.offerAmount || 0).toLocaleString('id-ID')}).`,
      createdAt: new Date().toISOString(),
      read: false
    });

    closeCheckoutModal();
    showToast(`Offer accepted! Card ownership transferred & notification sent to Admin.`);
    fetchUnreadInboxCount();
  } catch (err) {
    console.error("Finalize Offer Error:", err);
    showToast("Error processing accepted offer.");
  }
}

async function declineTradeOffer(reqId) {
  try {
    await db.collection("trade_requests").doc(reqId).delete();
    showToast("Offer declined.");
  } catch (err) {
    console.error("Decline Error:", err);
  }
}

function openCounterOfferModal(reqId) {
  document.getElementById('counter-request-id').value = reqId;
  document.getElementById('counter-offer-modal').classList.remove('hidden');
}

function closeCounterOfferModal() {
  document.getElementById('counter-offer-modal').classList.add('hidden');
}

async function submitCounterOffer() {
  const reqId = document.getElementById('counter-request-id').value;
  const counterAmount = parseFloat(document.getElementById('counter-amount-input').value) || 0;

  try {
    await db.collection("trade_requests").doc(reqId).update({
      counterAmount: counterAmount,
      status: 'COUNTERED'
    });
    closeCounterOfferModal();
    showToast("Counter offer submitted!");
  } catch (err) {
    console.error("Counter Error:", err);
  }
}

async function adminCancelAuction() {
  try {
    await db.collection("auctions").doc("featured_active").set({
      status: "CANCELLED",
      highestBid: 0,
      highBidder: "None"
    }, { merge: true });
    showToast("Auction successfully cancelled by Admin.");
  } catch (err) {
    console.error("Cancel auction error:", err);
  }
}

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

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500 text-xs italic">No matching inventory records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((c, index) => {
    const cardPrice = c.price || c.baseFloorPrice || 0;
    const cardImg = c.imgUrl || c.img || 'https://via.placeholder.com/40';
    return `
      <tr class="hover:bg-slate-900/80 transition-colors border-b border-slate-800/60 ${index % 2 === 0 ? 'bg-slate-950/40' : 'bg-transparent'}">
        <td class="p-4 font-mono text-amber-400 font-bold flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-glow"></span>
          ${c.serial || '*0001'}
        </td>
        <td class="p-4 font-bold text-white flex items-center gap-3">
          <img src="${cardImg}" class="w-8 h-8 rounded-lg object-contain bg-slate-900 border border-slate-800 p-0.5">
          <span class="truncate max-w-[160px]">${c.name || 'Unnamed Card'}</span>
        </td>
        <td class="p-4">
          <span class="px-2.5 py-1 text-[10px] font-bold rounded-lg border ${c.type === 'PREMIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}">
            ${c.type || 'STANDARD'}
          </span>
        </td>
        <td class="p-4 font-mono font-bold text-emerald-400">Rp ${cardPrice.toLocaleString('id-ID')}</td>
        <td class="p-4 text-slate-300 font-medium">
          <div class="flex items-center gap-2">
            <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${c.owner || 'Admin House'}" class="w-5 h-5 rounded-full border border-slate-700">
            <span class="truncate max-w-[140px]">${c.owner || 'Admin House'}</span>
          </div>
        </td>
        <td class="p-4">
          <span class="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${c.status === 'SOLD' ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'}">
            ${c.status || 'AVAILABLE'}
          </span>
        </td>
        <td class="p-4 text-right">
          <button onclick="openEditInventoryModal('${c.id}')" class="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-xl text-xs font-black border border-slate-700/80 transition-all shadow-sm">
            <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function backupInventoryJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cardsData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `eugene_cards_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Inventory backup downloaded successfully!");
}

function importInventoryJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const importedCards = JSON.parse(e.target.result);
      if (!Array.isArray(importedCards)) {
        showToast("Invalid JSON format. Expected an array of cards.");
        return;
      }

      for (const card of importedCards) {
        if (card.id) {
          const { id, ...cardData } = card;
          await db.collection("cards").doc(id).set(cardData, { merge: true });
        } else {
          await db.collection("cards").add(card);
        }
      }

      showToast(`Successfully imported ${importedCards.length} cards into inventory!`);
      fetchInventoryData();
    } catch (err) {
      console.error("Import JSON Error:", err);
      showToast("Failed to parse or import JSON file.");
    }
  };
  reader.readAsText(file);
}

async function openEditInventoryModal(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-name').value = card.name || '';
  
  const typeSelect = document.getElementById('edit-card-type');
  typeSelect.value = card.type || 'STANDARD';

  document.getElementById('edit-card-serial').value = formatSerialNumber(card.serial || '1', typeSelect.value);
  document.getElementById('edit-card-edition').value = card.edition || '';
  document.getElementById('edit-card-sn').value = card.sn || '';
  document.getElementById('edit-card-tier').value = card.tier || '';
  document.getElementById('edit-card-printing').value = card.printing || '';
  document.getElementById('edit-card-price').value = card.price || card.baseFloorPrice || 0;
  document.getElementById('edit-card-status').value = card.status || 'AVAILABLE';
  document.getElementById('edit-card-img').value = card.imgUrl || card.img || '';

  await populateOwnerDropdown(card.owner || 'Admin House');
  document.getElementById('inventory-edit-modal').classList.remove('hidden');
}

function handleInventoryTypeChange() {
  const currentSerial = document.getElementById('edit-card-serial').value;
  const newType = document.getElementById('edit-card-type').value;
  document.getElementById('edit-card-serial').value = formatSerialNumber(currentSerial, newType);
}

function formatSerialNumber(rawVal, cardType) {
  if (!rawVal) return cardType === 'STANDARD' ? '*0001' : '*01';
  let cleaned = String(rawVal).replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10) || 1;
  const padded = cardType === 'STANDARD' ? String(num).padStart(4, '0') : String(num).padStart(2, '0');
  return `*${padded}`;
}

async function populateOwnerDropdown(currentOwner) {
  const ownerSelect = document.getElementById('edit-card-owner-select');
  if (!ownerSelect) return;

  const defaultOptions = [
    { label: 'Admin House', value: 'Admin House' },
    { label: 'eugene.aquila06@gmail.com (Admin)', value: 'eugene.aquila06@gmail.com' },
    { label: 'yujinybwork@gmail.com (Admin)', value: 'yujinybwork@gmail.com' }
  ];

  let usersList = [];
  try {
    const snapshot = await db.collection("users").get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        usersList.push({
          label: `${data.displayName || data.email} (${data.role || 'REGULAR'})`,
          value: data.displayName || data.email
        });
      }
    });
  } catch (err) {
    console.error("Error fetching users:", err);
  }

  const allOwners = [...defaultOptions];
  usersList.forEach(u => {
    if (!allOwners.some(o => o.value.toLowerCase() === u.value.toLowerCase())) {
      allOwners.push(u);
    }
  });

  if (currentOwner && !allOwners.some(o => o.value.toLowerCase() === currentOwner.toLowerCase())) {
    allOwners.push({ label: `${currentOwner} (Current)`, value: currentOwner });
  }

  ownerSelect.innerHTML = allOwners.map(opt => `
    <option value="${opt.value}" ${opt.value.toLowerCase() === (currentOwner || '').toLowerCase() ? 'selected' : ''}>
      ${opt.label}
    </option>
  `).join('');
}

async function saveInventoryCardChanges() {
  const id = document.getElementById('edit-card-id').value;
  if (!id) return;

  const cardType = document.getElementById('edit-card-type').value;
  const rawSerial = document.getElementById('edit-card-serial').value;

  const updatedData = {
    name: document.getElementById('edit-card-name').value,
    serial: formatSerialNumber(rawSerial, cardType),
    type: cardType,
    edition: document.getElementById('edit-card-edition').value,
    sn: document.getElementById('edit-card-sn').value,
    tier: document.getElementById('edit-card-tier').value,
    printing: document.getElementById('edit-card-printing').value,
    price: parseFloat(document.getElementById('edit-card-price').value) || 0,
    status: document.getElementById('edit-card-status').value,
    owner: document.getElementById('edit-card-owner-select').value,
    imgUrl: document.getElementById('edit-card-img').value
  };

  try {
    await db.collection("cards").doc(id).update(updatedData);
    closeInventoryModal();
    showToast("Card attributes updated!");
  } catch (err) {
    console.error("Save Error:", err);
    showToast("Failed to update card.");
  }
}

function closeInventoryModal() {
  document.getElementById('inventory-edit-modal').classList.add('hidden');
}

function loadProfileBanner() {
  document.getElementById('dashboard-banner-name').textContent = userProfile.name || 'Collector';
  document.getElementById('dashboard-banner-username').textContent = `@${userProfile.username || 'collector'}`;
  document.getElementById('dashboard-banner-bio').textContent = userProfile.bio || 'Genesis Card Enthusiast';
  
  if (userProfile.avatar) {
    document.getElementById('dashboard-banner-avatar').src = userProfile.avatar;
  }

  const igLink = document.getElementById('banner-link-instagram');
  const igHandle = document.getElementById('banner-ig-handle');
  if (userProfile.instagram) {
    const cleanedIg = userProfile.instagram.replace('@', '');
    igLink.href = `https://instagram.com/${cleanedIg}`;
    igHandle.textContent = `@${cleanedIg}`;
    igLink.classList.remove('hidden');
  } else {
    igLink.classList.add('hidden');
  }

  const ttLink = document.getElementById('banner-link-tiktok');
  const ttHandle = document.getElementById('banner-tt-handle');
  if (userProfile.tiktok) {
    const cleanedTt = userProfile.tiktok.startsWith('@') ? userProfile.tiktok : `@${userProfile.tiktok}`;
    ttLink.href = `https://tiktok.com/${cleanedTt}`;
    ttHandle.textContent = cleanedTt;
    ttLink.classList.remove('hidden');
  } else {
    ttLink.classList.add('hidden');
  }

  const webLink = document.getElementById('banner-link-website');
  const webUrlSpan = document.getElementById('banner-web-url');
  if (userProfile.website) {
    let formattedUrl = userProfile.website;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    webLink.href = formattedUrl;
    try {
      const parsed = new URL(formattedUrl);
      webUrlSpan.textContent = parsed.hostname;
    } catch (e) {
      webUrlSpan.textContent = "Website";
    }
    webLink.classList.remove('hidden');
  } else {
    webLink.classList.add('hidden');
  }
}

function openProfileManagerModal() {
  document.getElementById('profile-edit-name-input').value = userProfile.name || '';
  document.getElementById('profile-edit-username-input').value = userProfile.username || '';
  document.getElementById('profile-edit-bio-input').value = userProfile.bio || '';
  document.getElementById('profile-edit-avatar-input').value = userProfile.avatar || '';
  document.getElementById('profile-edit-instagram-input').value = userProfile.instagram || '';
  document.getElementById('profile-edit-tiktok-input').value = userProfile.tiktok || '';
  document.getElementById('profile-edit-website-input').value = userProfile.website || '';
  
  document.getElementById('profile-manager-modal').classList.remove('hidden');
}

function closeProfileManagerModal() {
  document.getElementById('profile-manager-modal').classList.add('hidden');
}

async function saveProfileChanges() {
  const newName = document.getElementById('profile-edit-name-input').value || 'Collector';
  let newUsername = (document.getElementById('profile-edit-username-input').value || 'collector').toLowerCase().replace('@', '').trim();

  if (currentUser) {
    try {
      const snapshot = await db.collection("users").get();
      let isTaken = false;
      snapshot.forEach(doc => {
        if (doc.id !== currentUser.uid) {
          const data = doc.data();
          if (data.username && data.username.toLowerCase() === newUsername) {
            isTaken = true;
          }
        }
      });

      if (isTaken) {
        showToast("Error: Username is already taken by another account.");
        return;
      }
    } catch (err) {
      console.error("Username check error:", err);
    }
  }

  userProfile = {
    name: newName,
    username: newUsername,
    bio: document.getElementById('profile-edit-bio-input').value || 'Collector Bio',
    avatar: document.getElementById('profile-edit-avatar-input').value || '',
    instagram: document.getElementById('profile-edit-instagram-input').value || '',
    tiktok: document.getElementById('profile-edit-tiktok-input').value || '',
    website: document.getElementById('profile-edit-website-input').value || ''
  };

  localStorage.setItem('eugene_profile', JSON.stringify(userProfile));

  if (currentUser) {
    try {
      await db.collection("users").doc(currentUser.uid).set({
        displayName: userProfile.name,
        username: userProfile.username,
        bio: userProfile.bio,
        avatar: userProfile.avatar,
        instagram: userProfile.instagram,
        tiktok: userProfile.tiktok,
        website: userProfile.website
      }, { merge: true });
    } catch (err) {
      console.error("Profile sync error:", err);
    }
  }

  loadProfileBanner();
  closeProfileManagerModal();
  showToast("Profile settings saved successfully!");
}

function renderMyVault() {
  const container = document.getElementById('owned-cards-grid');
  if (!container) return;

  const myName = userProfile.name || 'Eugene';
  const myCards = cardsData.filter(c => c.owner === myName || c.owner === (currentUser ? currentUser.email : ''));

  if (myCards.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">Your vault is empty. Buy cards from the collection!</div>`;
    return;
  }

  container.innerHTML = myCards.map(card => {
    const cardPrice = card.price || card.baseFloorPrice || 100000;
    const cardImg = card.imgUrl || card.img || 'https://via.placeholder.com/150';
    return `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-center text-[10px]">
            <span class="text-amber-400 font-mono font-bold">${card.serial || '*0001'}</span>
            <span class="text-slate-400">${card.type || 'STANDARD'}</span>
          </div>
          <div class="w-full aspect-[4/5] bg-slate-950 rounded-xl overflow-hidden p-1 border border-slate-800 flex items-center justify-center my-2">
            <img src="${cardImg}" class="h-full object-contain">
          </div>
          <h4 class="text-xs font-bold text-white truncate">${card.name}</h4>
          <p class="text-[11px] font-mono text-emerald-400 font-bold mt-0.5">Floor Value: Rp ${cardPrice.toLocaleString('id-ID')}</p>
        </div>

        <div class="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800">
          <button onclick="sellBackToAdmin('${card.id}')" class="py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-[10px] font-extrabold rounded-lg border border-rose-500/30">Sell</button>
          <button onclick="listOwnedCardForTrade('${card.id}')" class="py-1.5 bg-amber-500/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-extrabold rounded-lg border border-amber-500/30">Trade</button>
          <button onclick="putCardOnAuction('${card.id}')" class="py-1.5 bg-emerald-500/20 hover:bg-emerald-400/30 text-emerald-300 text-[10px] font-extrabold rounded-lg border border-emerald-500/30">Auction</button>
        </div>
      </div>
    `;
  }).join('');
}

async function sellBackToAdmin(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  const floorPrice = card.price || card.baseFloorPrice || 100000;
  if (!confirm(`Are you sure you want to sell "${card.name}" back to Admin for Rp ${floorPrice.toLocaleString('id-ID')}?`)) return;

  try {
    await db.collection("cards").doc(cardId).update({ owner: 'Admin House' });
    showToast(`Successfully sold card back to Admin for Rp ${floorPrice.toLocaleString('id-ID')}`);
    renderMyVault();
  } catch (err) {
    console.error("Sell back error:", err);
    showToast("Failed to sell card back.");
  }
}

async function listOwnedCardForTrade(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  const listingPayload = {
    cardId: card.id,
    cardName: card.name,
    serial: card.serial,
    imgUrl: card.imgUrl || card.img || '',
    askingPrice: card.price || card.baseFloorPrice || 100000,
    seller: userProfile.name || (currentUser ? currentUser.displayName : 'Collector'),
    sellerEmail: currentUser ? currentUser.email : 'collector@eugene.com',
    createdAt: new Date().toISOString()
  };

  try {
    await db.collection("trade_listings").add(listingPayload);
    showToast(`Listed "${card.name}" in Trading Room successfully!`);
    switchTab('trade');
  } catch (err) {
    console.error("List trade error:", err);
  }
}

async function putCardOnAuction(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  try {
    await db.collection("auctions").doc("featured_active").set({
      cardId: card.id,
      cardName: card.name,
      serial: card.serial,
      imgUrl: card.imgUrl || card.img || '',
      owner: card.owner,
      startingBid: card.price || card.baseFloorPrice || 100000,
      highestBid: card.price || card.baseFloorPrice || 100000,
      highBidder: "Admin House",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    showToast(`Successfully put "${card.name}" up for live Auction!`);
    switchTab('auction');
  } catch (err) {
    console.error("Put on auction error:", err);
  }
}

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

  container.innerHTML = savedCards.map(card => {
    const cardImg = card.imgUrl || card.img || 'https://via.placeholder.com/150';
    return `
      <div onclick="openCardDetailModal('${card.id}')" class="card-holo-standard rounded-2xl p-3 cursor-pointer space-y-2">
        <div class="flex justify-between text-[10px] font-mono text-amber-400">
          <span>${card.serial || '*0001'}</span>
          <button onclick="event.stopPropagation(); toggleWishlist('${card.id}')" class="text-rose-500"><i class="fa-solid fa-heart"></i></button>
        </div>
        <div class="w-full aspect-[4/5] bg-slate-950 rounded-xl p-1 overflow-hidden flex items-center justify-center">
          <img src="${cardImg}" class="h-full object-contain">
        </div>
        <h4 class="text-xs font-bold text-white truncate">${card.name}</h4>
      </div>
    `;
  }).join('');
}

function addToCart(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  if (cart.some(item => item.id === cardId)) {
    showToast("Card is already in your cart.");
    return;
  }

  cart.push(card);
  localStorage.setItem('eugene_cart', JSON.stringify(cart));
  updateCartUI();
  showToast(`Added "${card.name}" to cart.`);
}

function removeFromCart(cardId) {
  cart = cart.filter(item => item.id !== cardId);
  localStorage.setItem('eugene_cart', JSON.stringify(cart));
  updateCartUI();
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
    const itemPrice = item.price || item.baseFloorPrice || 0;
    const itemImg = item.imgUrl || item.img || 'https://via.placeholder.com/50';
    subtotal += itemPrice;
    return `
      <div class="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
        <div class="flex items-center gap-3">
          <img src="${itemImg}" class="w-10 h-10 object-contain rounded bg-slate-900 border border-slate-800">
          <div>
            <h5 class="text-xs font-bold text-white">${item.name}</h5>
            <span class="text-[10px] font-mono text-amber-400 font-bold">Rp ${itemPrice.toLocaleString('id-ID')}</span>
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

  let subtotal = cart.reduce((sum, item) => sum + (item.price || item.baseFloorPrice || 0), 0);
  let total = subtotal + Math.round(subtotal * 0.02);

  document.getElementById('checkout-modal-title').textContent = "Scan & Pay via Official QRIS (Eugene Card - Toraja Utara)";
  document.getElementById('qris-amount-display').textContent = `Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById('qris-img-element').src = DEFAULT_QRIS_IMAGE;
  
  const actionBtn = document.getElementById('checkout-action-btn');
  actionBtn.setAttribute('onclick', 'submitOrderWithProof()');

  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function submitOrderWithProof() {
  if (cart.length === 0) return;

  let subtotal = cart.reduce((sum, item) => sum + (item.price || item.baseFloorPrice || 0), 0);
  let grandTotal = subtotal + Math.round(subtotal * 0.02);

  const orderData = {
    orderRef: '#EC-' + Math.floor(100000 + Math.random() * 900000),
    buyerName: userProfile.name || (currentUser ? currentUser.displayName : 'Collector'),
    buyerEmail: currentUser ? currentUser.email : 'guest@eugenecard.com',
    itemNames: cart.map(i => i.name).join(', '),
    totalAmount: grandTotal,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  try {
    await db.collection("orders").add(orderData);
    cart = [];
    localStorage.setItem('eugene_cart', JSON.stringify([]));
    updateCartUI();
    closeCheckoutModal();
    showToast("QRIS Order submitted for approval!");
    switchTab('history');
  } catch (err) {
    console.error("Order Submit Error:", err);
    showToast("Failed to submit order.");
  }
}

function renderAdminHub() {
  const container = document.getElementById('admin-pending-orders-list');
  if (!container) return;

  const pendingOrders = orderHistory.filter(o => (o.status || 'PENDING') === 'PENDING');
  const totalCardsCount = cardsData.length;
  const totalValuation = cardsData.reduce((sum, c) => sum + (c.price || c.baseFloorPrice || 100000), 0);

  const metricsHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Total Database Cards</span>
        <p class="text-2xl font-black text-amber-400 font-mono mt-1">${totalCardsCount}</p>
      </div>
      <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Total Valuation</span>
        <p class="text-2xl font-black text-emerald-400 font-mono mt-1">Rp ${totalValuation.toLocaleString('id-ID')}</p>
      </div>
      <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Pending Actions</span>
        <p class="text-2xl font-black text-rose-400 font-mono mt-1">${pendingOrders.length}</p>
      </div>
    </div>
  `;

  const broadcastHTML = `
    <div class="bg-slate-950 p-4 rounded-2xl border border-indigo-500/30 space-y-3 mb-6">
      <h5 class="text-xs font-black text-indigo-400 uppercase tracking-wider"><i class="fa-solid fa-bullhorn mr-1.5"></i> Broadcast Announcement to All Collectors</h5>
      <textarea id="admin-broadcast-msg" rows="2" placeholder="Type announcement or drop notice..." class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"></textarea>
      <button onclick="sendAdminBroadcast()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow">Send Broadcast Notice</button>
    </div>
  `;

  let ordersHTML = '';
  if (pendingOrders.length === 0) {
    ordersHTML = `<p class="text-xs text-slate-500 py-3">No pending transactions requiring approval.</p>`;
  } else {
    ordersHTML = pendingOrders.map(o => `
      <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center text-xs mb-2">
        <div>
          <span class="font-mono text-amber-400 font-bold">${o.orderRef || '#000'}</span>
          <p class="text-white font-bold">${o.buyerName || 'Buyer'}</p>
          <p class="text-slate-400">${o.itemNames || 'Items'}</p>
          <p class="text-emerald-400 font-mono">Rp ${(o.totalAmount || 0).toLocaleString('id-ID')}</p>
        </div>
        <button onclick="approveOrder('${o.id}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl">
          Approve Payment
        </button>
      </div>
    `).join('');
  }

  container.innerHTML = metricsHTML + broadcastHTML + `
    <h4 class="text-xs font-extrabold text-slate-200 uppercase tracking-wider mb-3">Pending Orders Requiring Action</h4>
    <div class="space-y-2">${ordersHTML}</div>
  `;
}

async function sendAdminBroadcast() {
  const msgInput = document.getElementById('admin-broadcast-msg');
  const text = msgInput.value.trim();
  if (!text) return;

  const adminEmail = currentUser ? currentUser.email : 'eugene.aquila06@gmail.com';

  try {
    await db.collection("messages").add({
      sender: adminEmail,
      recipient: 'all_collectors@eugene.com',
      text: `📢 ADMIN ANNOUNCEMENT: ${text}`,
      createdAt: new Date().toISOString(),
      read: false
    });
    msgInput.value = '';
    showToast("Broadcast announcement sent successfully!");
  } catch (err) {
    console.error("Broadcast error:", err);
    showToast("Failed to send broadcast.");
  }
}

async function approveOrder(orderId) {
  try {
    await db.collection("orders").doc(orderId).update({ status: 'APPROVED' });
    showToast("Order approved successfully!");
    fetchOrderHistory();
  } catch (err) {
    console.error("Approve Error:", err);
    showToast("Failed to approve order.");
  }
}

function refreshAdminHub() {
  fetchOrderHistory();
  fetchInventoryData();
  showToast("Refreshed admin records.");
}

function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  const myEmail = currentUser ? currentUser.email : '';
  const filtered = orderHistory.filter(o => {
    if (historyFilter === 'MINE') return o.buyerEmail === myEmail;
    if (historyFilter === 'APPROVED') return o.status === 'APPROVED';
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">No transaction history records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => `
    <tr class="hover:bg-slate-950 transition-colors">
      <td class="p-3.5 font-mono text-amber-400 font-bold">${o.orderRef || '#EC-000'}</td>
      <td class="p-3.5 font-bold text-white">
        <button onclick="openPopoutChat('${o.buyerEmail || ''}', '${o.buyerName || 'Collector'}')" class="hover:text-indigo-400 flex items-center gap-1.5 underline underline-offset-2">
          <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${o.buyerName || 'Collector'}" class="w-5 h-5 rounded-full border border-slate-800">
          ${o.buyerName || 'Collector'}
        </button>
      </td>
      <td class="p-3.5 text-slate-300">${o.itemNames || 'Card Stock'}</td>
      <td class="p-3.5 font-mono text-emerald-400 font-bold">Rp ${(o.totalAmount || 0).toLocaleString('id-ID')}</td>
      <td class="p-3.5"><i class="fa-solid fa-qrcode text-indigo-400"></i> QRIS Verified</td>
      <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${o.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${o.status || 'PENDING'}</span></td>
      <td class="p-3.5 text-right font-mono text-slate-400">${new Date(o.createdAt || Date.now()).toLocaleDateString()}</td>
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

async function searchUsersForChat() {
  const query = (document.getElementById('user-chat-search-input')?.value || '').toLowerCase().trim();
  const resultsContainer = document.getElementById('user-chat-search-results');
  if (!resultsContainer) return;

  if (!query) {
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
    return;
  }

  try {
    const snapshot = await db.collection("users").get();
    let matches = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const name = (data.displayName || data.email || '').toLowerCase();
      if (name.includes(query)) {
        matches.push(data);
      }
    });

    if (matches.length === 0) {
      resultsContainer.innerHTML = `<div class="p-2 text-slate-500 text-xs">No collectors found.</div>`;
      resultsContainer.classList.remove('hidden');
      return;
    }

    resultsContainer.innerHTML = matches.map(m => `
      <div onclick="openPopoutChat('${m.email}', '${m.displayName || m.email}')" class="p-2.5 bg-slate-950 hover:bg-slate-900 rounded-xl cursor-pointer flex items-center justify-between text-xs border border-slate-800">
        <span class="font-bold text-white">${m.displayName || m.email}</span>
        <span class="text-indigo-400 font-bold">Open Chat <i class="fa-solid fa-arrow-right ml-1"></i></span>
      </div>
    `).join('');
    resultsContainer.classList.remove('hidden');
  } catch (err) {
    console.error("Chat Search Error:", err);
  }
}

function openPopoutChat(recipientEmail, recipientName) {
  activeChatRecipient = recipientEmail;
  document.getElementById('chat-header-name').textContent = recipientName || recipientEmail;
  document.getElementById('chat-header-avatar').src = `https://api.dicebear.com/7.x/identicon/svg?seed=${recipientEmail}`;
  document.getElementById('popout-chat-modal').classList.remove('hidden');
  
  loadPopoutChatMessages();
}

function closePopoutChat() {
  document.getElementById('popout-chat-modal').classList.add('hidden');
  activeChatRecipient = null;
  clearChatScreenshot();
}

function attachChatScreenshot(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    currentChatScreenshotBase64 = e.target.result;
    document.getElementById('chat-screenshot-img').src = currentChatScreenshotBase64;
    document.getElementById('chat-screenshot-preview-container').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearChatScreenshot() {
  currentChatScreenshotBase64 = null;
  document.getElementById('chat-screenshot-preview-container').classList.add('hidden');
  document.getElementById('chat-screenshot-img').src = '';
}

async function sendPopoutChatMessage() {
  const textInput = document.getElementById('popout-chat-input');
  const text = textInput.value.trim();
  if ((!text && !currentChatScreenshotBase64) || !activeChatRecipient) return;

  const senderEmail = currentUser ? currentUser.email : 'collector@eugene.com';

  const messagePayload = {
    sender: senderEmail,
    recipient: activeChatRecipient,
    text: text || '',
    screenshot: currentChatScreenshotBase64 || null,
    createdAt: new Date().toISOString(),
    read: false
  };

  try {
    await db.collection("messages").add(messagePayload);
    textInput.value = '';
    clearChatScreenshot();
    loadPopoutChatMessages();
  } catch (err) {
    console.error("Send message error:", err);
    showToast("Failed to send message.");
  }
}

function loadPopoutChatMessages() {
  const container = document.getElementById('popout-chat-messages');
  if (!container || !activeChatRecipient) return;

  db.collection("messages").orderBy("createdAt", "asc").onSnapshot(snapshot => {
    let messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

    const myEmail = (currentUser ? currentUser.email : 'collector@eugene.com').toLowerCase().trim();
    const targetEmail = activeChatRecipient.toLowerCase().trim();

    const threadMessages = messages.filter(m => {
      const sender = (m.sender || '').toLowerCase().trim();
      const recipient = (m.recipient || '').toLowerCase().trim();
      
      const isMyMessageToThem = sender === myEmail && (recipient === targetEmail || recipient === 'all_collectors@eugene.com');
      const isTheirMessageToMe = sender === targetEmail && recipient === myEmail;
      const isBroadcast = recipient === 'all_collectors@eugene.com';

      return isMyMessageToThem || isTheirMessageToMe || isBroadcast;
    });

    if (threadMessages.length === 0) {
      container.innerHTML = `<div class="text-center py-10 text-slate-500 text-xs">No messages in this thread yet. Start the conversation!</div>`;
      return;
    }

    container.innerHTML = threadMessages.map(msg => {
      const isMe = (msg.sender || '').toLowerCase().trim() === myEmail;
      return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1">
          <div class="max-w-[80%] p-3 rounded-2xl text-xs ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'}">
            ${msg.text ? `<p>${msg.text}</p>` : ''}
            ${msg.screenshot ? `<img src="${msg.screenshot}" class="mt-2 rounded-xl max-h-48 object-cover border border-slate-700">` : ''}
          </div>
          <span class="text-[9px] font-mono text-slate-500">${new Date(msg.createdAt || Date.now()).toLocaleTimeString()}</span>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }, err => console.error("Chat thread load error:", err));
}

function loadUserInboxThreads() {
  const container = document.getElementById('inbox-threads-list');
  if (!container) return;

  db.collection("messages").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    let messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

    const userEmail = currentUser ? currentUser.email : 'collector@eugene.com';
    const myMessages = messages.filter(m => m.recipient === userEmail || m.sender === userEmail || m.recipient === 'all_collectors@eugene.com');

    if (myMessages.length === 0) {
      container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-3xl">No inbox messages yet.</div>`;
      return;
    }

    const correspondents = {};
    myMessages.forEach(m => {
      const otherUser = m.sender === userEmail ? m.recipient : m.sender;
      if (!correspondents[otherUser]) correspondents[otherUser] = m;
    });

    container.innerHTML = Object.keys(correspondents).map(email => {
      const lastMsg = correspondents[email];
      return `
        <div onclick="openPopoutChat('${email}', '${email}')" class="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 cursor-pointer space-y-2 transition-all shadow">
          <div class="flex items-center gap-2.5">
            <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${email}" class="w-9 h-9 rounded-full border border-slate-800">
            <div>
              <h4 class="text-xs font-bold text-white">${email}</h4>
              <p class="text-[10px] text-slate-400 truncate max-w-[200px]">${lastMsg.text || '[Attachment]'}</p>
            </div>
          </div>
          <div class="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/80">
            <span>${new Date(lastMsg.createdAt || Date.now()).toLocaleDateString()}</span>
            <span class="text-indigo-400 font-bold">Open Chat <i class="fa-solid fa-arrow-right"></i></span>
          </div>
        </div>
      `;
    }).join('');
  }, err => console.error("Inbox load error:", err));
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