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
  checkNotifications();
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

// ── Rollover checker ────────────────────────────────────────────────────
async function checkRollover() {
  try {
    var stored  = JSON.parse(localStorage.getItem('budget_rollover') || '{}');
    var today   = new Date();
    var prevM   = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    var prevY   = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    var prevYm  = ymKey(prevY, prevM);
    if (stored[prevYm]) return;

    var allTx   = await getAllTxs();
    var monthTx = allTx.filter(function (t) { return t.ym === prevYm; });
    var income  = monthTx.filter(function (t) { return t.type === 'income'; })
                         .reduce(function (s, t) { return s + t.amount; }, 0);
    var expense = monthTx.filter(function (t) { return (t.type || 'expense') === 'expense'; })
                         .reduce(function (s, t) { return s + t.amount; }, 0);
    var surplus = Math.round((income - expense) * 100) / 100;

    if (surplus <= 0) {
      stored[prevYm] = 'no_surplus';
      localStorage.setItem('budget_rollover', JSON.stringify(stored));
      return;
    }

    openRollover(surplus, prevYm);
  } catch (e) { console.warn('checkRollover:', e); }
}

// ── Notifications ────────────────────────────────────────────────────────
async function checkNotifications() {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    var stored  = JSON.parse(localStorage.getItem('budget_notif') || '{}');
    var goals   = await getAllRecords('goals');
    var active  = goals.filter(function (g) { return g.active; });
    if (!active.length) return;

    var today   = todayISO();
    var curYm   = ymKey(curY, curM);
    var txs     = await getTxsByYM(curY, curM);
    var expenses = txs.filter(function (t) { return (t.type || 'expense') === 'expense'; });
    var expTotal = expenses.reduce(function (s, t) { return s + t.amount; }, 0);

    for (var i = 0; i < active.length; i++) {
      var goal   = active[i];
      var key    = 'g' + goal.id + '_' + curYm;
      if (stored[key]) continue;

      var spent = 0;
      if (goal.type === 'category') {
        spent = expenses.filter(function (t) { return t.cat === goal.catId; })
                        .reduce(function (s, t) { return s + t.amount; }, 0);
      } else if (goal.type === 'total') {
        spent = expTotal;
      } else if (goal.type === 'period' && goal.dateFrom && goal.dateTo) {
        var rangeEnd = today > goal.dateTo ? goal.dateTo : today;
        var rTxs = await getTxsByDateRange(goal.dateFrom, rangeEnd);
        spent = rTxs.filter(function (t) { return (t.type || 'expense') === 'expense'; })
                    .reduce(function (s, t) { return s + t.amount; }, 0);
      } else { continue; }

      var pct = goal.amount > 0 ? spent / goal.amount * 100 : 0;
      if (pct < 80) continue;

      stored[key] = true;
      var title = pct >= 100 ? 'Budget overschreden!' : 'Budget bijna op (' + Math.round(pct) + '%)';
      var body  = esc(goal.label) + ': ' + eur(spent) + ' van ' + eur(goal.amount);

      if (swReg && swReg.showNotification) {
        swReg.showNotification(title, { body: body, icon: '/BudgetApp/icons/icon-192.png', tag: key });
      } else {
        new Notification(title, { body: body, tag: key });
      }
    }
    localStorage.setItem('budget_notif', JSON.stringify(stored));
  } catch (e) { console.warn('checkNotifications:', e); }
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
      var recTxType = item.type || 'expense';
      var recCat    = recTxType === 'income' ? 'inkomst' : (item.cat || 'overig');
      await addTx({ amount: item.amount, cat: recCat, date: txDate, ym: curYM2,
                    desc: item.desc || '', ts: Date.now(), type: recTxType });
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
  await checkRollover();
  registerSW(); // non-blocking
})();
