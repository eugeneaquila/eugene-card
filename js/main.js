// js/main.js

let currentTab = 'catalog';
let cardsData = [];
let tradeListings = [];
let tradeRequests = [];
let orderHistory = [];
let currentUser = null;
let unreadChatNotifications = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchInventoryData();
  listenForUnreadChatsAsNotifications();
  switchTab('catalog');
});

function switchTab(tabName) {
  currentTab = tabName;
  
  const sections = ['catalog', 'trade', 'auction', 'trade-req', 'inbox', 'holders', 'history', 'dashboard', 'wishlist', 'admin', 'inventory'];
  sections.forEach(sec => {
    const el = document.getElementById(`view-${sec}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white');
    btn.classList.add('text-slate-400');
  });

  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-800', 'text-white');
  }

  if (tabName === 'inbox') {
    loadUserInboxThreads();
  }
}

// ROUTE UNREAD CHAT MESSAGES DIRECTLY TO THE NOTIFICATION SYSTEM
function listenForUnreadChatsAsNotifications() {
  const myEmail = currentUser ? currentUser.email : 'collector@eugene.com';

  db.collection("messages")
    .where("recipient", "==", myEmail)
    .where("read", "==", false)
    .onSnapshot(snapshot => {
      unreadChatNotifications = [];
      snapshot.forEach(doc => {
        unreadChatNotifications.push({ id: doc.id, ...doc.data() });
      });

      updateNotificationBadgeUI();
    }, err => console.error("Error listening to unread chat notifications:", err));
}

function updateNotificationBadgeUI() {
  const badge = document.getElementById('notification-badge');
  const notifList = document.getElementById('notification-list');
  if (!badge || !notifList) return;

  const count = unreadChatNotifications.length;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');

    notifList.innerHTML = unreadChatNotifications.map(msg => `
      <div onclick="openChatFromNotification('${msg.sender}')" class="p-3 hover:bg-slate-950 cursor-pointer flex items-start gap-2.5 transition-colors">
        <div class="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <i class="fa-solid fa-comment-dots text-xs"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-white truncate">${msg.sender || 'Collector'}</p>
          <p class="text-[11px] text-slate-400 truncate">${msg.text || '[Image / Attachment]'}</p>
          <span class="text-[9px] font-mono text-indigo-400">Click to reply in Inbox</span>
        </div>
      </div>
    `).join('');
  } else {
    badge.classList.add('hidden');
    notifList.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">No new unread messages or notifications.</div>`;
  }
}

function toggleNotificationMenu() {
  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

function openChatFromNotification(senderEmail) {
  toggleNotificationMenu();
  switchTab('inbox');
  markMessageAsRead(senderEmail);
}

function markMessageAsRead(senderEmail) {
  const myEmail = currentUser ? currentUser.email : 'collector@eugene.com';

  db.collection("messages")
    .where("sender", "==", senderEmail)
    .where("recipient", "==", myEmail)
    .where("read", "==", false)
    .get()
    .then(snapshot => {
      const batch = db.batch();
      snapshot.forEach(doc => batch.update(doc.ref, { read: true }));
      batch.commit();
    })
    .catch(err => console.error("Error marking message as read:", err));
}

function fetchInventoryData() {
  db.collection("cards").onSnapshot(snapshot => {
    cardsData = [];
    snapshot.forEach(doc => cardsData.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'catalog') renderCardGrid();
  });
}

function renderCardGrid() {
  const container = document.getElementById('card-grid');
  if (!container) return;

  if (cardsData.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No cards available.</div>`;
    return;
  }

  container.innerHTML = cardsData.map(card => `
    <div class="card-holo-standard rounded-2xl p-3 space-y-2">
      <div class="flex justify-between items-center text-[10px] font-extrabold text-amber-400 font-mono">
        <span>${card.serial || '*0001'}</span>
        <span>${card.type || 'STANDARD'}</span>
      </div>
      <div class="w-full aspect-[4/5] bg-slate-950 rounded-xl overflow-hidden p-1 border border-slate-800 flex items-center justify-center">
        <img src="${card.imgUrl || card.img || 'https://via.placeholder.com/150'}" class="h-full object-contain">
      </div>
      <h4 class="text-xs font-black text-white truncate">${card.name || 'Card Name'}</h4>
    </div>
  `).join('');
}

function loadUserInboxThreads() {
  const container = document.getElementById('inbox-threads-list');
  if (!container) return;

  const myEmail = currentUser ? currentUser.email : 'collector@eugene.com';

  db.collection("messages").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    let messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

    const myMessages = messages.filter(m => m.recipient === myEmail || m.sender === myEmail);

    if (myMessages.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-3xl">No chat conversations yet.</div>`;
      return;
    }

    const threads = {};
    myMessages.forEach(m => {
      const otherUser = m.sender === myEmail ? m.recipient : m.sender;
      if (!threads[otherUser]) threads[otherUser] = m;
    });

    container.innerHTML = Object.keys(threads).map(email => {
      const lastMsg = threads[email];
      return `
        <div onclick="markMessageAsRead('${email}')" class="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 cursor-pointer space-y-2 transition-all">
          <div class="flex items-center gap-2.5">
            <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${email}" class="w-9 h-9 rounded-full border border-slate-800">
            <div>
              <h4 class="text-xs font-bold text-white">${email}</h4>
              <p class="text-[10px] text-slate-400 truncate max-w-[220px]">${lastMsg.text || '[Attachment]'}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  });
}

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