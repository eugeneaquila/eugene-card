// js/main.js

// Global App State Variables
let currentTab = 'catalog';
let currentFilter = 'ALL';
let historyFilter = 'ALL';
let cart = [];
let cardsData = [];
let searchDebounceTimer = null;

// Default QRIS Image Source
const DEFAULT_QRIS_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23ffffff'/><rect x='20' y='20' width='60' height='60' fill='%23000000'/><rect x='30' y='30' width='40' height='40' fill='%23ffffff'/><rect x='40' y='40' width='20' height='20' fill='%23000000'/><rect x='120' y='20' width='60' height='60' fill='%23000000'/><rect x='130' y='30' width='40' height='40' fill='%23ffffff'/><rect x='140' y='40' width='20' height='20' fill='%23000000'/><rect x='20' y='120' width='60' height='60' fill='%23000000'/><rect x='30' y='130' width='40' height='40' fill='%23ffffff'/><rect x='40' y='140' width='20' height='20' fill='%23000000'/><text x='100' y='110' font-family='sans-serif' font-size='10' font-weight='bold' text-anchor='middle' fill='%23000000'>OFFICIAL QRIS</text></svg>";

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  fetchInventoryData();
  setupQrisImage();
});

// Navigation Tab Switcher
function switchTab(tabName) {
  currentTab = tabName;
  
  // Hide all sections
  const sections = ['catalog', 'trade', 'auction', 'trade-req', 'inbox', 'holders', 'history', 'dashboard', 'wishlist', 'admin', 'inventory'];
  sections.forEach(sec => {
    const el = document.getElementById(`view-${sec}`);
    if (el) el.classList.add('hidden');
  });

  // Show active view
  const activeEl = document.getElementById(`view-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  // Update navbar button highlight styles
  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white');
    btn.classList.add('text-slate-400');
  });

  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-800', 'text-white');
  }

  // Trigger tab-specific loads
  if (tabName === 'inventory') renderInventoryTable();
  if (tabName === 'history') renderHistoryTable();
}

// Fetch Inventory Data Realtime from Firestore
function fetchInventoryData() {
  db.collection("cards").onSnapshot((snapshot) => {
    cardsData = [];
    snapshot.forEach(doc => {
      cardsData.push({ id: doc.id, ...doc.data() });
    });
    
    updateRemainingCardsCount();
    renderCardGrid();
  }, (error) => {
    console.error("Error fetching cards:", error);
  });
}

// Render Main Collection Catalog Grid
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
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No cards found matching criteria.</div>`;
    return;
  }

  container.innerHTML = filteredCards.map(card => {
    const isPremium = card.type === 'PREMIUM';
    const holoClass = isPremium ? 'card-holo-premium' : 'card-holo-standard';
    
    return `
      <div onclick="openCardDetailModal('${card.id}')" class="${holoClass} rounded-2xl p-3 cursor-pointer flex flex-col justify-between space-y-2 relative group">
        <div class="flex justify-between items-center text-[10px] font-extrabold">
          <span class="px-2 py-0.5 rounded-full ${isPremium ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">${card.type || 'STANDARD'}</span>
          <span class="font-mono text-slate-400">${card.serial || '*00'}</span>
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

// Debounced Search Engine Input Handler
function debouncedRenderCardGrid() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderCardGrid();
  }, 250);
}

// Set Type Filter (ALL / PREMIUM / STANDARD)
function setFilter(filter) {
  currentFilter = filter;
  ['ALL', 'PREMIUM', 'STANDARD'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 transition-all';
      } else {
        btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition-all';
      }
    }
  });
  renderCardGrid();
}

// Update Beta Stock Header Counter
function updateRemainingCardsCount() {
  const countEl = document.getElementById('remaining-cards-count');
  if (countEl) {
    const available = cardsData.filter(c => c.status === 'AVAILABLE' || !c.status).length;
    countEl.textContent = available;
  }
}

// Open Detail View Modal
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

// Shopping Cart Functions
function addToCart(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  if (cart.some(item => item.id === cardId)) {
    showToast("Card is already in your cart.");
    return;
  }

  cart.push(card);
  updateCartUI();
  showToast(`Added "${card.name}" to cart.`);
}

function removeFromCart(cardId) {
  cart = cart.filter(item => item.id !== cardId);
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
  
  if (drawer.classList.contains('translate-x-full')) {
    overlay.classList.remove('hidden');
    drawer.classList.remove('translate-x-full');
  } else {
    overlay.classList.add('hidden');
    drawer.classList.add('translate-x-full');
  }
}

// QRIS Checkout Flow
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

function setupQrisImage() {
  const qrisImg = document.getElementById('qris-img-element');
  if (qrisImg) qrisImg.src = DEFAULT_QRIS_IMAGE;
}

// Toast Notification Banner
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

// Inventory Table Renderer (Admin)
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const search = (document.getElementById('inventory-search')?.value || '').toLowerCase();

  const items = cardsData.filter(c => 
    !search || 
    c.name?.toLowerCase().includes(search) || 
    c.serial?.toLowerCase().includes(search) || 
    c.owner?.toLowerCase().includes(search)
  );

  tbody.innerHTML = items.map(c => `
    <tr class="hover:bg-slate-950 transition-colors">
      <td class="p-3 font-mono text-amber-400 font-bold">${c.serial || '*00'}</td>
      <td class="p-3 font-bold text-white">${c.name || 'Unnamed'}</td>
      <td class="p-3 text-slate-400">${c.edition || 'Beta'}</td>
      <td class="p-3 font-mono">Rp ${(c.price || 0).toLocaleString('id-ID')}</td>
      <td class="p-3 text-slate-300">${c.owner || 'House'}</td>
      <td class="p-3"><span class="px-2 py-0.5 text-[10px] font-bold rounded ${c.status === 'SOLD' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">${c.status || 'AVAILABLE'}</span></td>
      <td class="p-3 text-right">
        <button onclick="openEditInventoryModal('${c.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[10px] font-bold">Edit</button>
      </td>
    </tr>
  `).join('');
}

// Stub Handlers for Navigation Elements
function renderHistoryTable() {}
function toggleNotificationMenu() {
  const el = document.getElementById('notification-dropdown');
  if (el) el.classList.toggle('hidden');
}
function clearNotifications() {}
function closeChatDrawer() {
  const overlay = document.getElementById('chat-drawer-overlay');
  const drawer = document.getElementById('chat-drawer');
  if (overlay) overlay.classList.add('hidden');
  if (drawer) drawer.classList.add('translate-x-full');
}