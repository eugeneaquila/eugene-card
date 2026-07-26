// js/auth.js

let currentUser = null;
let userRole = 'REGULAR';
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
    logoutBtn: "Sign Out",
    limitedEdition: "LIMITED EDITION",
    betaStockTitle: "Beta Edition Card Stock",
    betaStockSubtitle: "Official QRIS Primary Market Availability (2% Tax Included)",
    remainingCards: "Remaining Cards",
    tradeRoomTitle: "TRADING ROOM",
    tradeRoomSubtitle: "Buy and sell directly with other collectors via QRIS • 2% tax per trade",
    listCardBtn: "List a Card",
    tradeRequestsTitle: "TRADE REQUESTS",
    tradeRequestsSubtitle: "Accept, decline, or counter offers submitted by other collectors.",
    proposeTradeBtn: "Propose Card Offer",
    holdersDirectoryTitle: "Holders Directory",
    holdersDirectorySub: "Click on any collector row to view their entire Binder / Vault, or submit an offer on owned cards.",
    thOwner: "Owner Name",
    thCardsOwned: "Cards Owned",
    thSerialsHeld: "Serials Held",
    thAction: "Action",
    counterOfferTitle: "Counter Trade Offer",
    counterAmountLabel: "Counter Amount (IDR)",
    sendCounterBtn: "Send Counter Offer"
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
    logoutBtn: "Keluar",
    limitedEdition: "EDISI TERBATAS",
    betaStockTitle: "Stok Kartu Edisi Beta",
    betaStockSubtitle: "Ketersediaan Pasar Utama Resmi QRIS (Termasuk Pajak 2%)",
    remainingCards: "Sisa Kartu",
    tradeRoomTitle: "RUANG TRADING",
    tradeRoomSubtitle: "Jual beli langsung antar kolektor via QRIS • Pajak 2% per transaksi",
    listCardBtn: "Daftarkan Kartu",
    tradeRequestsTitle: "PERMINTAAN TUKAR / PENAWARAN",
    tradeRequestsSubtitle: "Terima, tolak, atau ajukan penawaran balasan dari kolektor lain.",
    proposeTradeBtn: "Ajukan Penawaran Kartu",
    holdersDirectoryTitle: "Direktori Pemegang Kartu",
    holdersDirectorySub: "Klik baris kolektor untuk melihat seluruh Brankas/Album mereka, atau ajukan penawaran pada kartu yang dimiliki.",
    thOwner: "Nama Pemilik",
    thCardsOwned: "Kartu Dimiliki",
    thSerialsHeld: "Serial Dipegang",
    thAction: "Aksi",
    counterOfferTitle: "Penawaran Balasan (Counter Offer)",
    counterAmountLabel: "Jumlah Penawaran Balasan (IDR)",
    sendCounterBtn: "Kirim Penawaran Balasan"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(currentLanguage);
  updateAuthUI(null);

  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      if (user && user.email) {
        const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin(user.email);
        if (isAdmin) {
          userRole = 'ADMIN';
        } else {
          try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            userRole = (userDoc.exists && userDoc.data().role) ? userDoc.data().role : 'REGULAR';
          } catch (e) {
            userRole = 'REGULAR';
          }
        }
      } else {
        userRole = 'REGULAR';
      }

      updateAuthUI(currentUser);
      if (typeof onAuthResolved === 'function') {
        onAuthResolved(currentUser);
      }
    });
  }
});

function updateAuthUI(user) {
  const container = document.getElementById('auth-header-container');
  const isAdmin = user && user.email && typeof isUserAdmin === 'function' && isUserAdmin(user.email);

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

  const currentLangDict = translations[currentLanguage] || translations.EN;

  if (user) {
    const userEmail = user.email || 'collector';
    const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(userEmail)}`;
    
    const roleBadge = userRole === 'ADMIN' 
      ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">ADMIN</span>'
      : userRole === 'PLUS' 
        ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PLUS</span>'
        : '<button onclick="upgradeToPlus()" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/40">UPGRADE</button>';

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <button onclick="openProfileManagerModal()" class="flex items-center gap-1.5 cursor-pointer focus:outline-none group" title="Click to open Profile Settings">
          <img src="${avatarUrl}" class="w-8 h-8 rounded-full border border-amber-500/50 object-cover group-hover:scale-105 group-hover:border-amber-400 transition-all">
          ${roleBadge}
        </button>
        <button onclick="logout()" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-xs rounded-xl border border-slate-800 transition-all">
          ${currentLangDict.logoutBtn || 'Sign Out'}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openAuthModal()" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md">
        ${currentLangDict.loginBtn || 'Sign In'}
      </button>
    `;
  }
}

async function loginWithGoogle() {
  if (typeof auth === 'undefined') return;
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
  if (typeof auth !== 'undefined') {
    await auth.signOut();
  }
  currentUser = null;
  userRole = 'REGULAR';
  updateAuthUI(null);
  showToast("Logged out successfully.");
  if (typeof switchTab === 'function') switchTab('catalog');
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