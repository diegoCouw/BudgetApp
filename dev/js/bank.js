// ── Bank API integratie ──────────────────────────────────────────────────
var BACKEND = 'https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io';
var _bankTxs = [];
var _bankPage = 1;
var _bankCatFilter = null;
var BANK_PAGE_SIZE = 25;

var BANK_CATS = [
  { label: 'Boodschappen',      emoji: '🛒', color: '#16a34a' },
  { label: 'Restaurant',        emoji: '🍽️', color: '#ea580c' },
  { label: 'Transport',         emoji: '🚗', color: '#2563eb' },
  { label: 'Loon',              emoji: '💰', color: '#16a34a' },
  { label: 'Huur',              emoji: '🏠', color: '#7c3aed' },
  { label: 'Nutsvoorzieningen', emoji: '💡', color: '#d97706' },
  { label: 'Abonnement',        emoji: '🔄', color: '#0891b2' },
  { label: 'Kleding',           emoji: '👕', color: '#db2777' },
  { label: 'Gezondheid',        emoji: '❤️', color: '#dc2626' },
  { label: 'Vrije tijd',        emoji: '🎮', color: '#7c3aed' },
  { label: 'Sparen',            emoji: '🏦', color: '#0d9488' },
  { label: 'Overig',            emoji: '📦', color: '#64748b' },
];

function getCatMeta(label) {
  if (!label) return null;
  return BANK_CATS.find(function (c) { return c.label === label; }) || { label: label, emoji: '🏷️', color: '#64748b' };
}

// ── Token storage ─────────────────────────────────────────────────────────
function getToken() {
  try { return localStorage.getItem('prospero_jwt'); } catch (_) { return null; }
}
function setToken(t) {
  try { localStorage.setItem('prospero_jwt', t); } catch (_) {}
}
function clearToken() {
  try { localStorage.removeItem('prospero_jwt'); } catch (_) {}
}

// ── API helpers ───────────────────────────────────────────────────────────
async function apiCall(method, path, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  var token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body)  opts.body = JSON.stringify(body);
  var resp = await fetch(BACKEND + path, opts);
  if (resp.status === 401) { clearToken(); renderBank(); return null; }
  return resp;
}

// ── Render bank view ──────────────────────────────────────────────────────
async function renderBank() {
  var token = getToken();
  if (!token) { renderBankLogin(); return; }
  renderBankMain();
}

function renderBankLogin() {
  var el = document.getElementById('view-bank');
  el.innerHTML =
    '<div class="bank-login">' +
      '<div class="bank-login-icon">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '</div>' +
      '<p class="bank-login-title">Inloggen</p>' +
      '<p class="bank-login-sub">Voer je Prospero wachtwoord in</p>' +
      '<div class="pw-wrap">' +
        '<input class="form-in" type="password" id="bank-pw" placeholder="Wachtwoord" autocomplete="current-password">' +
        '<button class="pw-toggle" id="bank-pw-toggle" type="button" aria-label="Wachtwoord tonen">' +
          '<svg class="pw-eye" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '<svg class="pw-eye-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>' +
        '</button>' +
      '</div>' +
      '<button class="btn-primary bank-login-btn" id="bank-login-btn">Inloggen</button>' +
      '<p class="bank-login-err" id="bank-login-err" hidden></p>' +
    '</div>';

  document.getElementById('bank-login-btn').addEventListener('click', doLogin);
  document.getElementById('bank-pw').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('bank-pw-toggle').addEventListener('click', function () {
    var input = document.getElementById('bank-pw');
    var isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    this.querySelector('.pw-eye').hidden = isHidden;
    this.querySelector('.pw-eye-off').hidden = !isHidden;
  });
}

async function doLogin() {
  var pw   = document.getElementById('bank-pw').value;
  var btn  = document.getElementById('bank-login-btn');
  var err  = document.getElementById('bank-login-err');
  if (!pw) return;
  btn.disabled = true;
  btn.textContent = 'Bezig…';
  try {
    var resp = await fetch(BACKEND + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (resp.ok) {
      var data = await resp.json();
      setToken(data.token);
      renderBankMain();
    } else {
      err.textContent = 'Verkeerd wachtwoord';
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Inloggen';
    }
  } catch (e) {
    err.textContent = 'Verbinding mislukt';
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Inloggen';
  }
}

async function renderBankMain() {
  var el = document.getElementById('view-bank');
  el.innerHTML =
    '<div class="bank-header">' +
      '<div class="bank-actions">' +
        '<button class="btn-primary bank-action-btn" id="bank-connect-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
          'Bank koppelen' +
        '</button>' +
        '<button class="btn-ghost bank-action-btn" id="bank-sync-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
          'Synchroniseer' +
        '</button>' +
        '<button class="btn-ghost bank-action-btn bank-disconnect-btn" id="bank-disconnect-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="1" y1="1" x2="23" y2="23"/></svg>' +
          'Verbreek koppeling' +
        '</button>' +
        '<button class="btn-ghost bank-logout-btn" id="bank-logout-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '</button>' +
      '</div>' +
      '<p class="bank-status" id="bank-status"></p>' +
    '</div>' +
    '<div class="bank-filter">' +
      '<input class="search-in" type="search" id="bank-search" placeholder="Zoek transactie…" autocomplete="off">' +
    '</div>' +
    '<div class="bank-cat-filter" id="bank-cat-filter"></div>' +
    '<div id="bank-tx-list"></div>' +
    '<div id="bank-load-more"></div>';

  document.getElementById('bank-connect-btn').addEventListener('click', doConnect);
  document.getElementById('bank-sync-btn').addEventListener('click', doSync);
  document.getElementById('bank-disconnect-btn').addEventListener('click', doDisconnect);
  document.getElementById('bank-logout-btn').addEventListener('click', function () {
    clearToken(); renderBankLogin();
  });
  document.getElementById('bank-search').addEventListener('input', function () {
    renderBankTxList(this.value);
  });

  _bankPage = 1;
  await loadBankTxs();
}

async function doDisconnect() {
  var btn = document.getElementById('bank-disconnect-btn');
  if (!btn) return;

  if (btn.dataset.confirm !== 'yes') {
    btn.dataset.confirm = 'yes';
    btn.textContent = 'Zeker verbreken?';
    btn.classList.add('bank-disconnect-confirm');
    setTimeout(function () {
      if (btn.dataset.confirm === 'yes') {
        btn.dataset.confirm = '';
        btn.classList.remove('bank-disconnect-confirm');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Verbreek koppeling';
      }
    }, 4000);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Bezig…';
  var resp = await apiCall('DELETE', '/bank/session');
  if (!resp) return;
  if (resp.ok) {
    setStatus('Bankverbinding verbroken');
  } else {
    setStatus('Verbreken mislukt', true);
    btn.disabled = false;
  }
  btn.dataset.confirm = '';
  btn.classList.remove('bank-disconnect-confirm');
  btn.disabled = false;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Verbreek koppeling';
}

async function doConnect() {
  var btn = document.getElementById('bank-connect-btn');
  btn.disabled = true;
  btn.textContent = 'Bezig…';
  var resp = await apiCall('POST', '/bank/connect');
  if (!resp) return;
  if (resp.ok) {
    var data = await resp.json();
    window.location.href = data.url;
  } else {
    setStatus('Verbinding met bank mislukt', true);
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Bank koppelen';
  }
}

async function doSync() {
  var btn = document.getElementById('bank-sync-btn');
  btn.disabled = true;
  btn.textContent = 'Bezig…';
  setStatus('Transacties ophalen…');
  var today = new Date();
  var from  = new Date(today); from.setDate(today.getDate() - 30);
  var fromStr = from.toISOString().slice(0, 10);
  var toStr   = today.toISOString().slice(0, 10);
  var resp = await apiCall('GET', '/bank/sync?from=' + fromStr + '&to=' + toStr);
  if (!resp) return;
  if (resp.ok) {
    var data = await resp.json();
    setStatus(data.saved + ' nieuwe transacties opgeslagen, ' + data.skipped + ' overgeslagen');
    _bankPage = 1;
    await loadBankTxs();
  } else {
    setStatus('Sync mislukt', true);
  }
  btn.disabled = false;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Synchroniseer';
}

function setStatus(msg, isErr) {
  var el = document.getElementById('bank-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'bank-status' + (isErr ? ' bank-status-err' : '');
}

async function loadBankTxs() {
  var resp = await apiCall('GET', '/transactions');
  if (!resp || !resp.ok) { _bankTxs = []; renderBankCatFilter(); renderBankTxList(''); return; }
  var data = await resp.json();
  _bankTxs = data.transactions || [];
  renderBankCatFilter();
  renderBankTxList(document.getElementById('bank-search') ? document.getElementById('bank-search').value : '');
}

function renderBankCatFilter() {
  var el = document.getElementById('bank-cat-filter');
  if (!el) return;
  var usedCats = [...new Set(_bankTxs.map(function (t) { return t.category; }).filter(Boolean))];
  if (!usedCats.length) { el.innerHTML = ''; return; }
  var html = '<button class="bank-filter-chip' + (!_bankCatFilter ? ' active' : '') + '" data-cat="">Alle</button>';
  usedCats.forEach(function (cat) {
    var m = getCatMeta(cat);
    html += '<button class="bank-filter-chip' + (_bankCatFilter === cat ? ' active' : '') + '" data-cat="' + esc(cat) + '" style="--chip-color:' + m.color + '">' + m.emoji + ' ' + esc(cat) + '</button>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.bank-filter-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _bankCatFilter = this.dataset.cat || null;
      _bankPage = 1;
      renderBankCatFilter();
      renderBankTxList(document.getElementById('bank-search') ? document.getElementById('bank-search').value : '');
    });
  });
}

function renderBankTxList(search) {
  var el = document.getElementById('bank-tx-list');
  if (!el) return;
  var q = (search || '').toLowerCase();
  var filtered = _bankTxs.filter(function (t) {
    var matchSearch = !q || (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
    var matchCat = !_bankCatFilter || t.category === _bankCatFilter;
    return matchSearch && matchCat;
  });

  if (!filtered.length) {
    el.innerHTML = '<p class="bank-empty">' + (_bankTxs.length ? 'Geen resultaten' : 'Geen transacties — synchroniseer eerst') + '</p>';
    return;
  }

  var visible = filtered.slice(0, _bankPage * BANK_PAGE_SIZE);
  var html = '';
  var lastDate = '';
  visible.forEach(function (t) {
    if (t.date !== lastDate) {
      html += '<p class="section-label">' + fmtDay(t.date) + '</p>';
      lastDate = t.date;
    }
    var isCredit = t.type === 'inkomst';
    var amtClass = isCredit ? 'bank-amt-credit' : 'bank-amt-debit';
    var amtSign  = isCredit ? '+' : '-';
    html +=
      '<div class="tx-row bank-tx-row" data-id="' + t.id + '">' +
        '<div class="tx-info">' +
          '<span class="tx-desc">' + esc(t.description || '—') + '</span>' +
          (function() {
            if (!t.category) return '<span class="tx-cat bank-cat-label bank-cat-empty" data-id="' + t.id + '"><em>categorie instellen</em></span>';
            var m = getCatMeta(t.category);
            return '<span class="tx-cat bank-cat-label bank-cat-badge" data-id="' + t.id + '" style="--chip-color:' + m.color + '">' + m.emoji + ' ' + esc(t.category) + '</span>';
          })() +
        '</div>' +
        '<span class="tx-amt ' + amtClass + '">' + amtSign + eur(Math.abs(t.amount)) + '</span>' +
      '</div>';
  });
  el.innerHTML = html;

  // Load more
  var more = document.getElementById('bank-load-more');
  if (more) {
    if (visible.length < filtered.length) {
      more.innerHTML = '<button class="btn-ghost bank-more-btn" id="bank-more">Meer laden (' + (filtered.length - visible.length) + ')</button>';
      document.getElementById('bank-more').addEventListener('click', function () {
        _bankPage++;
        renderBankTxList(search);
      });
    } else {
      more.innerHTML = '';
    }
  }

  // Category click
  el.querySelectorAll('.bank-cat-label').forEach(function (label) {
    label.addEventListener('click', function () {
      openCategoryPicker(parseInt(this.dataset.id), this);
    });
  });
}

function openCategoryPicker(txId, labelEl) {
  var allCats = BANK_CATS.slice();
  if (typeof _userCats !== 'undefined') {
    _userCats.forEach(function (c) {
      if (!allCats.find(function (x) { return x.label === c.label; })) {
        allCats.push({ label: c.label, emoji: c.emoji || '🏷️', color: c.color || '#64748b' });
      }
    });
  }

  var currentTx = _bankTxs.find(function (t) { return t.id === txId; });
  var currentCat = currentTx ? currentTx.category : null;

  var html =
    '<p class="modal-title">Categorie instellen</p>' +
    '<div class="bank-cat-grid">';
  allCats.forEach(function (cat) {
    var isActive = currentCat === cat.label;
    html += '<button class="bank-cat-chip' + (isActive ? ' selected' : '') + '" data-cat="' + esc(cat.label) + '" style="--chip-color:' + cat.color + '">' +
      cat.emoji + ' ' + esc(cat.label) +
    '</button>';
  });
  html += '</div>' +
    '<div class="bank-cat-custom">' +
      '<input class="form-in" type="text" id="bank-cat-input" placeholder="Eigen categorie…" autocomplete="off">' +
      '<button class="btn-primary" id="bank-cat-custom-btn">Toevoegen</button>' +
    '</div>' +
    '<button class="btn-ghost" style="margin:8px 0 4px;width:100%" id="bank-cat-clear">Verwijder categorie</button>';

  openModal(html);

  document.querySelectorAll('.bank-cat-chip').forEach(function (chip) {
    chip.addEventListener('click', async function () {
      await setCategory(txId, this.dataset.cat, labelEl);
      closeModal();
    });
  });
  document.getElementById('bank-cat-custom-btn').addEventListener('click', async function () {
    var val = document.getElementById('bank-cat-input').value.trim();
    if (!val) return;
    await setCategory(txId, val, labelEl);
    closeModal();
  });
  document.getElementById('bank-cat-input').addEventListener('keydown', async function (e) {
    if (e.key !== 'Enter') return;
    var val = this.value.trim();
    if (!val) return;
    await setCategory(txId, val, labelEl);
    closeModal();
  });
  document.getElementById('bank-cat-clear').addEventListener('click', async function () {
    await setCategory(txId, null, labelEl);
    closeModal();
  });
}

async function setCategory(txId, cat, labelEl) {
  var resp = await apiCall('PATCH', '/transactions/' + txId + '/category', { category: cat });
  if (!resp || !resp.ok) return;
  var tx = _bankTxs.find(function (t) { return t.id === txId; });
  if (tx) tx.category = cat;
  if (labelEl) {
    if (!cat) {
      labelEl.className = 'tx-cat bank-cat-label bank-cat-empty';
      labelEl.innerHTML = '<em>categorie instellen</em>';
      labelEl.removeAttribute('style');
    } else {
      var m = getCatMeta(cat);
      labelEl.className = 'tx-cat bank-cat-label bank-cat-badge';
      labelEl.style.setProperty('--chip-color', m.color);
      labelEl.textContent = m.emoji + ' ' + cat;
    }
  }
  renderBankCatFilter();
}
