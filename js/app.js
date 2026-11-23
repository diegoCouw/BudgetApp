// ── Global state (var so render.js / modal.js can access) ──────────────
var curY          = new Date().getFullYear();
var curM          = new Date().getMonth();
var activeV       = 'home';
var swReg         = null;
var updateWaiting = false; // set true when a new SW is installed and waiting

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

    // Auto-detect: flag if a new SW is already waiting
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
    console.warn('Service Worker registration failed:', e);
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
}

// ── Boot ────────────────────────────────────────────────────────────────
(async function () {
  initTheme();
  await openDB();
  wire();
  await render();
  registerSW(); // non-blocking: runs in background
})();
