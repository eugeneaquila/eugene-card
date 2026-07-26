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
  if (!container) return;

  if (user) {
    const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`;
    const roleBadge = userRole === 'ADMIN' 
      ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">ADMIN</span>'
      : userRole === 'PLUS' 
        ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PLUS</span>'
        : '<button onclick="upgradeToPlus()" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/40">UPGRADE</button>';

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 cursor-pointer" onclick="openProfileManagerModal()" title="Click to edit Profile Settings">
          <img src="${avatarUrl}" class="w-8 h-8 rounded-full border border-amber-500/50 object-cover hover:opacity-80 transition-opacity">
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