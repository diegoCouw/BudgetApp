// ── Global state (var so render.js / modal.js can access) ──────────────
var curY          = new Date().getFullYear();
var curM          = new Date().getMonth();
var activeV       = 'home';
var swReg         = null;
var updateWaiting = false;
var curDateFrom   = null;  // date range filter for transacties view
var curDateTo     = null;
var _accounts     = [];    // loaded at boot, shared with modal.js

// ── Navigation ──────────────────────────────────────────────────────────
function switchView(v) {
  activeV = v;
  document.querySelectorAll('.view').forEach(function (el) {
    el.classList.remove('active');
  });
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.nb').forEach(function (b) {
    b.classList.toggle('active', b.dataset.v === v);
  });
  render();
}

async function render() {
  if      (activeV === 'home')         await renderHome();
  else if (activeV === 'transacties')  await renderTransacties();
  else if (activeV === 'statistieken') await renderStats();
}

// ── Theme ───────────────────────────────────────────────────────────────
function initTheme() {
  try {
    var t = localStorage.getItem('budget_theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (_) {}
}

function toggleTheme() {
  var root = document.documentElement;
  var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('budget_theme', next); } catch (_) {}
}

// ── Service Worker & Updates ────────────────────────────────────────────
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('./sw.js');
    if (swReg.waiting) updateWaiting = true;
    swReg.addEventListener('updatefound', function () {
      var installing = swReg.installing;
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          updateWaiting = true;
        }
      });
    });
  } catch (e) {
    console.warn('SW registration failed:', e);
  }
}

async function checkUpdate() {
  if (!swReg) return 'nosw';
  try {
    await swReg.update();

    // Already downloaded and waiting to activate
    if (swReg.waiting) return 'available';

    // Currently downloading — wait for install to finish
    if (swReg.installing) {
      return new Promise(function (resolve) {
        var sw = swReg.installing;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed') resolve('available');
          if (sw.state === 'redundant') resolve('uptodate');
        });
      });
    }

    return 'uptodate';
  } catch (_) {
    return 'error';
  }
}

function applyUpdate() {
  if (!swReg || !swReg.waiting) return;
  swReg.waiting.postMessage('skipWaiting');
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    window.location.reload();
  });
}

// ── Event wiring ────────────────────────────────────────────────────────
function wire() {
  // Bottom nav
  document.querySelectorAll('.nb').forEach(function (b) {
    b.addEventListener('click', function () { switchView(b.dataset.v); });
  });

  // FAB
  document.getElementById('fab').addEventListener('click', openAdd);

  // Header buttons
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // Modal: close on backdrop click or Escape
  document.getElementById('moverlay').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !document.getElementById('moverlay').hidden) closeModal();
  });

  // Month navigation
  function prevNext(prevId, nextId) {
    document.getElementById(prevId).addEventListener('click', function () {
      curM--; if (curM < 0) { curM = 11; curY--; }
      render();
    });
    document.getElementById(nextId).addEventListener('click', function () {
      curM++; if (curM > 11) { curM = 0; curY++; }
      render();
    });
  }
  prevNext('h-prev', 'h-next');
  prevNext('t-prev', 't-next');

  // Date range filter
  document.getElementById('t-filter-toggle').addEventListener('click', function () {
    var fields = document.getElementById('t-filter-fields');
    var toggle = document.getElementById('t-filter-toggle');
    fields.hidden = !fields.hidden;
    toggle.classList.toggle('active', !fields.hidden);
  });
  document.getElementById('t-from').addEventListener('change', function () {
    curDateFrom = this.value || null;
    if (activeV === 'transacties') renderTransacties();
  });
  document.getElementById('t-to').addEventListener('change', function () {
    curDateTo = this.value || null;
    if (activeV === 'transacties') renderTransacties();
  });
  document.getElementById('t-filter-clear').addEventListener('click', function () {
    curDateFrom = null; curDateTo = null;
    document.getElementById('t-from').value = '';
    document.getElementById('t-to').value   = '';
    document.getElementById('t-filter-fields').hidden = true;
    document.getElementById('t-filter-toggle').classList.remove('active');
    if (activeV === 'transacties') renderTransacties();
  });
}

// ── Recurring payments processor ────────────────────────────────────────
async function processRecurring() {
  try {
    var items    = await getAllRecords('recurring');
    var todayD   = new Date();
    var curYM2   = ymKey(todayD.getFullYear(), todayD.getMonth());
    var todayDay = todayD.getDate();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.lastProcessedYM === curYM2) continue;
      if (todayDay < item.dayOfMonth)      continue;
      var maxDay = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).getDate();
      var txDay  = Math.min(item.dayOfMonth, maxDay);
      var txDate = todayD.getFullYear() + '-' +
                   String(todayD.getMonth() + 1).padStart(2, '0') + '-' +
                   String(txDay).padStart(2, '0');
      await addTx({ amount: item.amount, cat: item.cat, date: txDate, ym: curYM2,
                    desc: item.desc || '', ts: Date.now(), type: 'expense' });
      item.lastProcessedYM = curYM2;
      await putRecord('recurring', item);
    }
  } catch (e) { console.warn('processRecurring:', e); }
}

// ── Boot ────────────────────────────────────────────────────────────────
(async function () {
  initTheme();
  await openDB();

  // Load user categories into _userCats (format.js global)
  var userCatRecs = await getAllRecords('categories');
  _userCats = userCatRecs.map(function (c) {
    return { id: 'u_' + c.id, dbId: c.id, label: c.label, emoji: c.emoji, color: c.color };
  });

  // Load accounts; ensure zichtrekening exists
  _accounts = await getAllRecords('accounts');
  var hasZicht = _accounts.some(function (a) { return a.type === 'zicht'; });
  if (!hasZicht) {
    var zId = await addRecord('accounts', { name: 'Zichtrekening', type: 'zicht', startBalance: 0 });
    _accounts.push({ id: zId, name: 'Zichtrekening', type: 'zicht', startBalance: 0 });
  }

  await processRecurring();
  wire();
  await render();
  registerSW(); // non-blocking
})();
