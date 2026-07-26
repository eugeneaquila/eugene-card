// js/analytics.js

let cardsData = [];
let ordersData = [];

document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      showPaywall();
      return;
    }

    const hasAccess = await checkUserAnalyticsAccess(user);
    if (!hasAccess) {
      showPaywall();
      return;
    }

    hidePaywall();
    initAnalyticsData();
  });
});

async function checkUserAnalyticsAccess(user) {
  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      const adminEmails = ["eugene.aquila06@gmail.com", "yujinybwork@gmail.com"];
      if (adminEmails.includes((user.email || "").toLowerCase().trim())) return true;
      if (data.role === 'PLUS' || data.role === 'ADMIN') return true;
    }
    return false;
  } catch (err) {
    console.error("Analytics Access Check Error:", err);
    return false;
  }
}

function showPaywall() {
  const paywallEl = document.getElementById('analytics-paywall');
  if (paywallEl) paywallEl.classList.remove('hidden');
}

function hidePaywall() {
  const paywallEl = document.getElementById('analytics-paywall');
  if (paywallEl) paywallEl.classList.add('hidden');
}

async function upgradeFromPaywall() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;
  try {
    await db.collection("users").doc(currentUser.uid).set({
      email: currentUser.email,
      role: 'PLUS',
      upgradedAt: new Date().toISOString()
    }, { merge: true });

    hidePaywall();
    initAnalyticsData();
  } catch (err) {
    console.error("Paywall Upgrade Error:", err);
  }
}

async function initAnalyticsData() {
  try {
    const cardsSnapshot = await db.collection("cards").get();
    cardsData = [];
    cardsSnapshot.forEach(doc => cardsData.push({ id: doc.id, ...doc.data() }));

    const ordersSnapshot = await db.collection("orders").get();
    ordersData = [];
    ordersSnapshot.forEach(doc => ordersData.push({ id: doc.id, ...doc.data() }));

    renderAnalyticsMetrics();
    renderMarketTrendChart();
    renderValuationTable();
  } catch (err) {
    console.error("Analytics Data Init Error:", err);
  }
}

function renderAnalyticsMetrics() {
  const totalVolume = ordersData.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const avgFloor = cardsData.length > 0 ? cardsData.reduce((sum, c) => sum + (c.price || c.baseFloorPrice || 0), 0) / cardsData.length : 0;
  const ownedCount = cardsData.filter(c => c.owner && c.owner !== 'House' && c.owner !== 'Admin House').length;

  const volEl = document.getElementById('analytics-total-volume');
  const avgEl = document.getElementById('analytics-avg-floor');
  const countEl = document.getElementById('analytics-collected-count');

  if (volEl) volEl.textContent = `Rp ${totalVolume.toLocaleString('id-ID')}`;
  if (avgEl) avgEl.textContent = `Rp ${Math.round(avgFloor).toLocaleString('id-ID')}`;
  if (countEl) countEl.textContent = `${ownedCount} / ${cardsData.length}`;
}

function renderMarketTrendChart() {
  const ctx = document.getElementById('marketTrendChart');
  if (!ctx || typeof Chart === 'undefined') return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['30D Ago', '25D Ago', '20D Ago', '15D Ago', '10D Ago', '5D Ago', 'Today'],
      datasets: [
        {
          label: 'Floor Price (IDR)',
          data: [120000, 125000, 130000, 128000, 135000, 142000, 150000],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Sales Volume (IDR)',
          data: [400000, 650000, 500000, 900000, 750000, 1100000, 1350000],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
      }
    }
  });
}

function calculateValuation(card) {
  const baseFloor = card.price || card.baseFloorPrice || 100000;
  const isPremium = card.type === 'PREMIUM';
  const rarityMultiplier = isPremium ? 1.45 : 1.0;
  const tierWeight = 1 + ((parseFloat(card.tier) || 100) / 2000);

  const estimatedPrice = Math.round(baseFloor * rarityMultiplier * tierWeight);
  const projectedPrice = Math.round(estimatedPrice * (isPremium ? 1.35 : 1.18));
  const volatility = isPremium ? 'Low (Stable)' : 'Medium';

  return { estimatedPrice, projectedPrice, volatility };
}

function renderValuationTable() {
  const tbody = document.getElementById('analytics-probability-table-body');
  if (!tbody) return;

  const searchQuery = (document.getElementById('analytics-search-input')?.value || '').toLowerCase().trim();

  const filtered = cardsData.filter(c => 
    !searchQuery || 
    (c.name && c.name.toLowerCase().includes(searchQuery)) ||
    (c.serial && c.serial.toLowerCase().includes(searchQuery))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">No card metrics found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const { estimatedPrice, projectedPrice, volatility } = calculateValuation(c);
    const cardPrice = c.price || c.baseFloorPrice || 0;
    return `
      <tr class="hover:bg-slate-950 transition-colors">
        <td class="p-3 font-bold text-white">${c.name || 'Unnamed'} <span class="text-amber-400 font-mono">(${c.serial || '*00'})</span></td>
        <td class="p-3 font-mono text-slate-300">${c.type || 'STANDARD'}</td>
        <td class="p-3 font-mono text-slate-400">Rp ${cardPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-amber-400 font-bold">Rp ${estimatedPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-emerald-400 font-extrabold">Rp ${projectedPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-xs text-slate-400">${volatility}</td>
        <td class="p-3 text-right"><span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/30">STRONG GROWTH</span></td>
      </tr>
    `;
  }).join('');
}