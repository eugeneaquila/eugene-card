// js/auth.js

// Active User State
let currentUser = null;
let currentPersona = localStorage.getItem('eugene_persona') || 'eugene.aquila06';
let currentLanguage = localStorage.getItem('eugene_lang') || 'EN';

// I18N Translations Dictionary
const translations = {
  EN: {
    brandTitle: "EUGENE CARD",
    betaEdition: "Beta Edition",
    brandSubtitle: "Trading Card Marketplace & Exchange Hub",
    navCollection: "Collection",
    navTrade: "Trade",
    navAuction: "Auction",
    navRequests: "Trade Requests",
    navAnalytics: "Analytics",
    navInbox: "Inbox",
    navHolders: "Holders",
    navHistory: "History",
    navVault: "My Vault",
    navWishlist: "Wishlist",
    navInventory: "Inventory",
    navAdmin: "Admin Hub",
    loginBtn: "Sign In",
    logoutBtn: "Sign Out"
  },
  ID: {
    brandTitle: "EUGENE CARD",
    betaEdition: "Edisi Beta",
    brandSubtitle: "Pasar & Pusat Pertukaran Kartu Koleksi",
    navCollection: "Koleksi",
    navTrade: "Jual Beli",
    navAuction: "Lelang",
    navRequests: "Permintaan Tukar",
    navAnalytics: "Analistik",
    navInbox: "Pesan",
    navHolders: "Pemegang Kartu",
    navHistory: "Riwayat",
    navVault: "Brankas Saya",
    navWishlist: "Keinginan",
    navInventory: "Inventaris",
    navAdmin: "Pusat Admin",
    loginBtn: "Masuk",
    logoutBtn: "Keluar"
  }
};

// Initialize Authentication Listener
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(currentLanguage);

  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      updateAuthUI(user);
    } else {
      currentUser = null;
      updateAuthUI(null);
    }
  });
});

// Update Auth UI Elements in Header
function updateAuthUI(user) {
  const container = document.getElementById('auth-header-container');
  if (!container) return;

  const isAdmin = (user && user.email === "eugene.aquila06@gmail.com") || currentPersona === 'eugene.aquila06';

  // Toggle Admin Nav Elements
  document.querySelectorAll('.admin-only-nav').forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  const sep = document.getElementById('admin-nav-separator');
  if (sep) {
    if (isAdmin) sep.classList.remove('hidden');
    else sep.classList.add('hidden');
  }

  if (user) {
    container.innerHTML = `
      <div class="flex items-center gap-2">
        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full border border-amber-500/50 object-cover">
        <button onclick="logout()" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-xs rounded-xl border border-slate-800 transition-all" data-i18n="logoutBtn">
          ${translations[currentLanguage].logoutBtn}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openAuthModal()" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md" data-i18n="loginBtn">
        ${translations[currentLanguage].loginBtn}
      </button>
    `;
  }
}

// Google Sign-In Handler
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    closeAuthModal();
    showToast(`Welcome back, ${result.user.displayName}!`);
  } catch (error) {
    console.error("Auth Error:", error);
    showToast("Authentication failed: " + error.message);
  }
}

// Logout Handler
async function logout() {
  await auth.signOut();
  showToast("Logged out successfully.");
}

// Admin Persona Switcher for Testing
function switchAccountPersona(persona) {
  currentPersona = persona;
  localStorage.setItem('eugene_persona', persona);
  showToast(`Switched active test persona to: ${persona}`);
  updateAuthUI(currentUser);
  if (typeof renderCardGrid === 'function') renderCardGrid();
}

// Modal Handlers for Auth
function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

// Language Toggle Engine
function toggleLanguage() {
  currentLanguage = currentLanguage === 'EN' ? 'ID' : 'EN';
  localStorage.setItem('eugene_lang', currentLanguage);
  applyLanguage(currentLanguage);
}

function applyLanguage(lang) {
  const label = document.getElementById('current-lang-label');
  if (label) label.textContent = lang;

  const dict = translations[lang] || translations.EN;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  updateAuthUI(currentUser);
}