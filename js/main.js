// js/main.js

let currentTab = 'catalog';
let currentFilter = 'ALL';
let historyFilter = 'ALL';

let cart = JSON.parse(localStorage.getItem('eugene_cart') || '[]');

let cardsData = [];
let tradeListings = [];
let tradeRequests = [];
let orderHistory = [];
let userWishlist = JSON.parse(localStorage.getItem('eugene_wishlist') || '[]');
let userProfile = JSON.parse(localStorage.getItem('eugene_profile') || '{"name":"Collector","username":"collector","bio":"Genesis Card Enthusiast","avatar":"","instagram":"","tiktok":"","website":""}');
let searchDebounceTimer = null;

const DEFAULT_QRIS_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23ffffff'/><rect x='20' y='20' width='60' height='60' fill='%23000000'/><rect x='30' y='30' width='40' height='40' fill='%23ffffff'/><rect x='40' y='40' width='20' height='20' fill='%23000000'/><rect x='120' y='20' width='60' height='60' fill='%23000000'/><rect x='130' y='30' width='40' height='40' fill='%23ffffff'/><rect x='140' y='40' width='20' height='20' fill='%23000000'/><rect x='20' y='120' width='60' height='60' fill='%23000000'/><rect x='30' y='130' width='40' height='40' fill='%23ffffff'/><rect x='40' y='140' width='20' height='20' fill='%23000000'/><text x='100' y='110' font-family='sans-serif' font-size='10' font-weight='bold' text-anchor='middle' fill='%23000000'>OFFICIAL QRIS</text></svg>";

document.addEventListener('DOMContentLoaded', () => {
  setupQrisImage();
  updateCartUI();
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
  }, err => {
    console.error("Error fetching cards:", err);
    if (cardsData.length === 0) renderCardGrid();
  });
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

function renderCardGrid() {
  const container = document.getElementById('card-grid');
  if (!container) return;

  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const displayCards = cardsData.length > 0 ? cardsData : Array.from({ length: 50 }, (_, i) => {
    const num = i + 1;
    const isPrem = num <= 10;
    return {
      id: `beta-card-${num}`,
      name: `Eugene Beta #${num}`,
      serial: isPrem ? `*${String(num).padStart(2, '0')}` : `*${String(num).padStart(3, '0')}`,
      type: isPrem ? 'PREMIUM' : 'STANDARD',
      price: isPrem ? 250000 : 100000,
      status: 'AVAILABLE',
      img: 'https://via.placeholder.com/200x250/0f172a/f59e0b?text=Eugene+Card'
    };
  });

  const filteredCards = displayCards.filter(card => {
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
    const cardPrice = card.price || 0;
    
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
            <span class="font-mono text-slate-400">${card.serial || '*00'}</span>
          </div>
        </div>

        <div class="w-full aspect-[4/5] bg-slate-950/60 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-800">
          <img src="${card.img || 'https://via.placeholder.com/150'}" alt="${card.name || 'Card'}" loading="lazy" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300">
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
        <img src="${card.img || 'https://via.placeholder.com/150'}" class="h-full object-contain">
      </div>
      <p class="text-xs font-bold text-white truncate">${card.name}</p>
      <p class="text-[10px] font-mono text-amber-400 font-bold">${card.serial || '*00'}</p>
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

  const currentUserEmail = currentUser ? currentUser.email : '';

  container.innerHTML = tradeRequests.map(req => {
    const isOwner = req.ownerEmail === currentUserEmail || req.targetOwner === (userProfile.name || 'Collector');
    const isBuyer = req.proposerEmail === currentUserEmail || req.proposer === (userProfile.name || 'Collector');
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
          ${isCountered && isBuyer ? `
            <button onclick="acceptCounterOffer('${req.id}')" class="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl">Accept Counter</button>
            <button onclick="declineTradeOffer('${req.id}')" class="flex-1 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-extrabold text-xs rounded-xl border border-rose-500/30">Decline Counter</button>
          ` : `
            <button onclick="acceptTradeOffer('${req.id}')" class="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl">Accept Offer</button>
            <button onclick="openCounterOfferModal('${req.id}')" class="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl">Counter Offer</button>
            <button onclick="declineTradeOffer('${req.id}')" class="flex-1 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-extrabold text-xs rounded-xl border border-rose-500/30">Decline Offer</button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function acceptTradeOffer(reqId) {
  try {
    await db.collection("trade_requests").doc(reqId).update({ status: 'ACCEPTED' });
    showToast("Trade offer accepted!");
  } catch (err) {
    console.error("Accept Error:", err);
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

async function acceptCounterOffer(reqId) {
  try {
    await db.collection("trade_requests").doc(reqId).update({ status: 'COMPLETED' });
    showToast("Counter offer accepted!");
  } catch (err) {
    console.error("Accept Counter Error:", err);
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

  tbody.innerHTML = items.map(c => `
    <tr class="hover:bg-slate-950 transition-colors">
      <td class="p-3 font-mono text-amber-400 font-bold">${c.serial || '*00'}</td>
      <td class="p-3 font-bold text-white">${c.name || 'Unnamed'}</td>
      <td class="p-3 text-slate-400">${c.type || 'STANDARD'}</td>
      <td class="p-3 font-mono">Rp ${(c.price || 0).toLocaleString('id-ID')}</td>
      <td class="p-3 text-slate-300">${c.owner || 'Admin House'}</td>
      <td class="p-3"><span class="px-2 py-0.5 text-[10px] font-bold rounded ${c.status === 'SOLD' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">${c.status || 'AVAILABLE'}</span></td>
      <td class="p-3 text-right">
        <button onclick="openEditInventoryModal('${c.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[10px] font-bold border border-slate-700">Edit Attributes</button>
      </td>
    </tr>
  `).join('');
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
  document.getElementById('edit-card-price').value = card.price || 0;
  document.getElementById('edit-card-status').value = card.status || 'AVAILABLE';
  document.getElementById('edit-card-img').value = card.img || '';

  await populateOwnerDropdown(card.owner || 'Admin House');
  document.getElementById('inventory-edit-modal').classList.remove('hidden');
}

function handleInventoryTypeChange() {
  const currentSerial = document.getElementById('edit-card-serial').value;
  const newType = document.getElementById('edit-card-type').value;
  document.getElementById('edit-card-serial').value = formatSerialNumber(currentSerial, newType);
}

function formatSerialNumber(rawVal, cardType) {
  if (!rawVal) return cardType === 'STANDARD' ? '*001' : '*01';

  let cleaned = rawVal.replace(/[^\d-]/g, '');

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const paddedParts = parts.map(part => {
      const num = parseInt(part, 10) || 0;
      return cardType === 'STANDARD' ? String(num).padStart(3, '0') : String(num).padStart(2, '0');
    });
    return paddedParts.join('-');
  } else {
    const num = parseInt(cleaned, 10) || 1;
    const padded = cardType === 'STANDARD' ? String(num).padStart(3, '0') : String(num).padStart(2, '0');
    return `*${padded}`;
  }
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
    img: document.getElementById('edit-card-img').value
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
  userProfile = {
    name: document.getElementById('profile-edit-name-input').value || 'Collector',
    username: document.getElementById('profile-edit-username-input').value || 'collector',
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
  const myCards = cardsData.filter(c => c.owner === myName || c.owner === 'eugene.aquila06');

  if (myCards.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">Your vault is empty. Buy cards from the collection!</div>`;
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
    </div>
  `).join('');
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