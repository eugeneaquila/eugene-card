<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Market Analytics | Eugene Card</title>
  
  <!-- Firebase Compatibility SDKs -->
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics-compat.js"></script>

  <!-- Tailwind CSS, FontAwesome & Chart.js -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">

  <!-- Header -->
  <header class="max-w-7xl mx-auto flex justify-between items-center mb-8">
    <a href="index.html" class="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-extrabold text-amber-400 hover:bg-slate-800 transition-all flex items-center gap-2">
      <i class="fa-solid fa-arrow-left"></i> Back to Marketplace
    </a>
    <div class="flex items-center gap-2">
      <span class="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black text-[10px] rounded-full">ADMIN ACCESS ONLY</span>
      <h1 class="text-sm font-black text-white uppercase tracking-wider hidden sm:block">Analytics & Valuation Hub</h1>
    </div>
  </header>

  <main class="max-w-7xl mx-auto space-y-6">

    <!-- KPI Metric Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Total Market Volume</span>
        <p id="analytics-total-volume" class="text-2xl font-black text-emerald-400 font-mono">Rp 0</p>
        <span class="text-[10px] text-emerald-500 font-semibold"><i class="fa-solid fa-arrow-trend-up mr-1"></i>+12.4% this month</span>
      </div>

      <div class="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Average Floor Price</span>
        <p id="analytics-avg-floor" class="text-2xl font-black text-amber-400 font-mono">Rp 0</p>
        <span class="text-[10px] text-slate-500 font-semibold">Across 50 Serial Cards</span>
      </div>

      <div class="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Circulating Supply</span>
        <p id="analytics-collected-count" class="text-2xl font-black text-indigo-400 font-mono">0 / 50</p>
        <span class="text-[10px] text-indigo-400 font-semibold">Held by verified collectors</span>
      </div>

      <div class="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Market Liquidity Index</span>
        <p id="analytics-liquidity-score" class="text-2xl font-black text-rose-400 font-mono">88.5 / 100</p>
        <span class="text-[10px] text-rose-400 font-semibold"><i class="fa-solid fa-bolt mr-1"></i>High Trade Velocity</span>
      </div>
    </div>

    <!-- Interactive Market Floor Velocity Chart -->
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wider"><i class="fa-solid fa-chart-area text-amber-400 mr-2"></i>Floor Price & Volume Trends</h3>
          <p class="text-xs text-slate-400">30-day historical execution price vs collection floor</p>
        </div>
        <div class="flex gap-2">
          <span class="text-[10px] bg-slate-950 border border-slate-800 px-3 py-1 rounded-xl text-emerald-400 font-mono font-bold">● Floor Price</span>
          <span class="text-[10px] bg-slate-950 border border-slate-800 px-3 py-1 rounded-xl text-indigo-400 font-mono font-bold">● QRIS Sales</span>
        </div>
      </div>
      <div class="h-64 w-full">
        <canvas id="marketTrendChart"></canvas>
      </div>
    </div>

    <!-- Probabilistic Pricing & Valuation Table -->
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wider"><i class="fa-solid fa-calculator text-amber-400 mr-2"></i>Probabilistic Valuation Matrix</h3>
          <p class="text-xs text-slate-400">Algorithmic fair-value forecasts based on tier rarity multipliers</p>
        </div>
        
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <input type="text" id="analytics-search-input" oninput="renderValuationTable()" placeholder="Search serial (*01)..." class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 w-full sm:w-48">
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th class="p-3">Card Serial & Name</th>
              <th class="p-3">Type</th>
              <th class="p-3">Current Floor</th>
              <th class="p-3">Est. Fair Value</th>
              <th class="p-3">Projected (6M)</th>
              <th class="p-3">Volatility Score</th>
              <th class="p-3 text-right">Rating</th>
            </tr>
          </thead>
          <tbody id="analytics-probability-table-body" class="divide-y divide-slate-800"></tbody>
        </table>
      </div>
    </div>

  </main>

  <script src="js/firebase-config.js"></script>
  <script src="js/analytics.js"></script>
</body>
</html>