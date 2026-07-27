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
const TRADE_FEE_PERCENT = 0.02;

async function loadRevenueData() {
  try {
    const txSnapshot = await db.collection("transactions").get();
    const transactions = [];
    txSnapshot.forEach(doc => transactions.push(doc.data()));

    const cardSnapshot = await db.collection("cards").get();
    const inventory = [];
    cardSnapshot.forEach(doc => inventory.push({ id: doc.id, ...doc.data() }));

    const tf = document.getElementById('rev-timeframe')?.value || 'ALL';
    const now = new Date();

    const approvedOrders = transactions.filter(tx => {
      if (tx.status !== 'APPROVED') return false;
      if (tf === 'ALL') return true;

      const txDate = tx.created_at ? new Date(tx.created_at) : new Date();
      if (tf === 'TODAY') return txDate.toDateString() === now.toDateString();
      if (tf === 'MONTH') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      return true;
    });

    const totalGross = approvedOrders.reduce((sum, tx) => sum + (tx.total_amount || 0), 0);
    const totalTax = totalGross * (TRADE_FEE_PERCENT / (1 + TRADE_FEE_PERCENT));
    const orderCount = approvedOrders.length;
    const aov = orderCount > 0 ? totalGross / orderCount : 0;

    document.getElementById('kpi-gross-sales').innerText = formatIDR(totalGross);
    document.getElementById('kpi-tax-collected').innerText = formatIDR(totalTax);
    document.getElementById('kpi-order-count').innerText = orderCount;
    document.getElementById('kpi-aov').innerText = formatIDR(aov);

    renderCardProfitabilityTable(inventory, transactions);
  } catch (err) {
    console.error("Error loading revenue data:", err);
  }
}

function renderCardProfitabilityTable(inventory, transactions) {
  const tbody = document.getElementById('card-revenue-table-body');
  if (!tbody) return;

  const cardRevenueMap = {};
  transactions.forEach(tx => {
    if (tx.status === 'APPROVED' && Array.isArray(tx.items)) {
      tx.items.forEach(item => {
        if (item.id) {
          cardRevenueMap[item.id] = (cardRevenueMap[item.id] || 0) + (item.price || 0);
        }
      });
    }
  });

  if (inventory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No inventory found.</td></tr>`;
    return;
  }

  tbody.innerHTML = inventory.map(card => {
    const rev = cardRevenueMap[card.id] || 0;
    return `
      <tr class="hover:bg-slate-950/50">
        <td class="p-3 font-mono font-bold text-amber-400">${card.serial}</td>
        <td class="p-3 font-bold text-white">${card.name}</td>
        <td class="p-3 font-mono text-slate-300">${formatIDR(card.price)}</td>
        <td class="p-3 font-mono font-black text-emerald-400">${formatIDR(rev)}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded text-[9px] font-bold ${card.status === 'SOLD' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">${card.status}</span></td>
      </tr>
    `;
  }).join('');
}

function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

document.addEventListener('DOMContentLoaded', loadRevenueData);