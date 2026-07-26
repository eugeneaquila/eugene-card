// js/main.js

// HOLDERS DIRECTORY WITH CLICKABLE VAULT BINDER & OFFER ACTIONS
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

// OPEN COLLECTOR VAULT BINDER MODAL
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

// OPEN PROPOSE TRADE MODAL PRE-POPULATED WITH CARD SERIAL
function openOfferModalForCard(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('trade-target-serial-input').value = card.serial || '';
  document.getElementById('trade-notes-input').value = `Offer for ${card.name}`;
  openProposeTradeModal();
}

// RENDER TRADE REQUESTS WITH ACCEPT, DECLINE & COUNTER ACTIONS
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

        <!-- Dynamic Action Buttons -->
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
    showToast("Offer declined and removed.");
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
    showToast("Counter offer submitted to buyer!");
  } catch (err) {
    console.error("Counter Error:", err);
  }
}

async function acceptCounterOffer(reqId) {
  try {
    await db.collection("trade_requests").doc(reqId).update({ status: 'COMPLETED' });
    showToast("Counter offer accepted! Proceeding to fulfillment.");
  } catch (err) {
    console.error("Accept Counter Error:", err);
  }
}