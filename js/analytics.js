// js/analytics.js

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const cardsSnapshot = await db.collection("cards").get();
    const cards = [];
    cardsSnapshot.forEach(doc => cards.push({ id: doc.id, ...doc.data() }));

    const ordersSnapshot = await db.collection("orders").get();
    const orders = [];
    ordersSnapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

    renderAnalyticsMetrics(cards, orders);
    renderValuationTable(cards);
  } catch (err) {
    console.error("Analytics Error:", err);
  }
});

function renderAnalyticsMetrics(cards, orders) {
  const totalVolume = orders.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const avgFloor = cards.length > 0 ? cards.reduce((sum, c) => sum + (c.price || 0), 0) / cards.length : 0;
  const ownedCount = cards.filter(c => c.owner && c.owner !== 'House').length;

  document.getElementById('analytics-total-volume').textContent = `Rp ${totalVolume.toLocaleString('id-ID')}`;
  document.getElementById('analytics-avg-floor').textContent = `Rp ${Math.round(avgFloor).toLocaleString('id-ID')}`;
  document.getElementById('analytics-collected-count').textContent = `${ownedCount} / ${cards.length}`;
}

function calculateValuation(card) {
  const baseFloor = card.price || 100000;
  const isPremium = card.type === 'PREMIUM';
  const rarityMultiplier = isPremium ? 1.45 : 1.0;
  const tierWeight = 1 + ((parseFloat(card.tier) || 100) / 2000);

  const estimatedPrice = Math.round(baseFloor * rarityMultiplier * tierWeight);
  const projectedPrice = Math.round(estimatedPrice * (isPremium ? 1.35 : 1.18));

  return { estimatedPrice, projectedPrice };
}

function renderValuationTable(cards) {
  const tbody = document.getElementById('analytics-probability-table-body');
  if (!tbody) return;

  tbody.innerHTML = cards.map(c => {
    const { estimatedPrice, projectedPrice } = calculateValuation(c);
    return `
      <tr class="hover:bg-slate-950 transition-colors">
        <td class="p-3 font-bold text-white">${c.name || 'Unnamed'} <span class="text-amber-400 font-mono">(${c.serial || '*00'})</span></td>
        <td class="p-3 font-mono text-slate-300">${c.type || 'STANDARD'}</td>
        <td class="p-3 font-mono text-slate-400">Rp ${(c.price || 0).toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-amber-400 font-bold">Rp ${estimatedPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-emerald-400 font-extrabold">Rp ${projectedPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 text-right"><span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/30">STRONG GROWTH</span></td>
      </tr>
    `;
  }).join('');
}