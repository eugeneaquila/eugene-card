// js/analytics.js
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Auth & Load DB
  const cardsSnapshot = await db.collection("cards").get();
  const cards = [];
  cardsSnapshot.forEach(doc => cards.push({ id: doc.id, ...doc.data() }));

  renderValuationTable(cards);
});

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
        <td class="p-3 font-bold text-white">${c.name} <span class="text-amber-400 font-mono">(${c.serial})</span></td>
        <td class="p-3">${c.type}</td>
        <td class="p-3 font-mono">Rp ${c.price?.toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-amber-400">Rp ${estimatedPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 font-mono text-emerald-400">Rp ${projectedPrice.toLocaleString('id-ID')}</td>
        <td class="p-3 text-right"><span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md font-bold">STRONG</span></td>
      </tr>
    `;
  }).join('');
}