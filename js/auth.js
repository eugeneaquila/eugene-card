// js/auth.js

function updateAuthUI(user) {
  const container = document.getElementById('auth-header-container');
  const isAdmin = user && typeof isUserAdmin === 'function' && isUserAdmin(user.email);

  // Show/Hide Admin Nav Buttons
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
    const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email)}`;
    const roleBadge = userRole === 'ADMIN' 
      ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">ADMIN</span>'
      : userRole === 'PLUS' 
        ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PLUS</span>'
        : '<button onclick="upgradeToPlus()" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/40">UPGRADE</button>';

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <button onclick="openProfileManagerModal()" class="flex items-center gap-1.5 focus:outline-none group" title="Click to open Profile Settings">
          <img src="${avatarUrl}" class="w-8 h-8 rounded-full border border-amber-500/50 object-cover group-hover:scale-105 group-hover:border-amber-400 transition-all">
          ${roleBadge}
        </button>
        <button onclick="logout()" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-xs rounded-xl border border-slate-800 transition-all">
          ${translations[currentLanguage] ? translations[currentLanguage].logoutBtn : 'Sign Out'}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openAuthModal()" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md">
        ${translations[currentLanguage] ? translations[currentLanguage].loginBtn : 'Sign In'}
      </button>
    `;
  }
}