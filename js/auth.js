// js/auth.js

let currentUser = null;
let userRole = 'REGULAR'; // Default role for standard users
let currentLanguage = localStorage.getItem('eugene_lang') || 'EN';

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

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(currentLanguage);

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      if (isUserAdmin(user.email)) {
        userRole = 'ADMIN';
      } else {
        const userDoc = await db.collection("users").doc(user.uid).get();
        userRole = (userDoc.exists && userDoc.data().role) ? userDoc.data().role : 'REGULAR';
      }
    } else {
      userRole = 'REGULAR';
    }

    updateAuthUI(user);
    if (typeof onAuthResolved === 'function') {
      onAuthResolved(user);
    }
  });
});

function updateAuthUI(user) {
  const container = document.getElementById('auth-header-container');
  const isAdmin = user && isUserAdmin(user.email);

  document.querySelectorAll('.admin-only-nav').forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  const sep = document.getElementById('admin-nav-separator');
  if (sep) {
    if (isAdmin) sep.classList.remove('hidden');
    else sep.classList.add('hidden');
  }

  if (!container) return;

  if (user) {
    const roleBadge = userRole === 'ADMIN' 
      ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">ADMIN</span>'
      : userRole === 'PLUS' 
        ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PLUS</span>'
        : '<button onclick="upgradeToPlus()" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/40">UPGRADE</button>';

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5">
          <img src="${user.photoURL || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + user.email}" class="w-8 h-8 rounded-full border border-amber-500/50 object-cover">
          ${roleBadge}
        </div>
        <button onclick="logout()" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-xs rounded-xl border border-slate-800 transition-all">
          ${translations[currentLanguage].logoutBtn}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openAuthModal()" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md">
        ${translations[currentLanguage].loginBtn}
      </button>
    `;
  }
}

async function upgradeToPlus() {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  try {
    await db.collection("users").doc(currentUser.uid).set({
      email: currentUser.email,
      role: 'PLUS',
      upgradedAt: new Date().toISOString()
    }, { merge: true });

    userRole = 'PLUS';
    updateAuthUI(currentUser);
    showToast("Congratulations! You are now a PLUS Member.");
  } catch (err) {
    console.error("Upgrade error:", err);
    showToast("Failed to upgrade account.");
  }
}

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

async function logout() {
  await auth.signOut();
  userRole = 'REGULAR';
  showToast("Logged out successfully.");
  switchTab('catalog');
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

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