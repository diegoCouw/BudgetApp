// ── Bank API integratie ──────────────────────────────────────────────────
var BACKEND = 'https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io';
var _bankTxs = [];
var _bankPage = 1;
var BANK_PAGE_SIZE = 25;

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
      '<input class="form-in" type="password" id="bank-pw" placeholder="Wachtwoord" autocomplete="current-password">' +
      '<button class="btn-primary bank-login-btn" id="bank-login-btn">Inloggen</button>' +
      '<p class="bank-login-err" id="bank-login-err" hidden></p>' +
    '</div>';

  document.getElementById('bank-login-btn').addEventListener('click', doLogin);
  document.getElementById('bank-pw').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
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
        '<button class="btn-ghost bank-logout-btn" id="bank-logout-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '</button>' +
      '</div>' +
      '<p class="bank-status" id="bank-status"></p>' +
    '</div>' +
    '<div class="bank-filter">' +
      '<input class="search-in" type="search" id="bank-search" placeholder="Zoek transactie…" autocomplete="off">' +
    '</div>' +
    '<div id="bank-tx-list"></div>' +
    '<div id="bank-load-more"></div>';

  document.getElementById('bank-connect-btn').addEventListener('click', doConnect);
  document.getElementById('bank-sync-btn').addEventListener('click', doSync);
  document.getElementById('bank-logout-btn').addEventListener('click', function () {
    clearToken(); renderBankLogin();
  });
  document.getElementById('bank-search').addEventListener('input', function () {
    renderBankTxList(this.value);
  });

  _bankPage = 1;
  await loadBankTxs();
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
  if (!resp || !resp.ok) { _bankTxs = []; renderBankTxList(''); return; }
  var data = await resp.json();
  _bankTxs = data.transactions || [];
  renderBankTxList(document.getElementById('bank-search') ? document.getElementById('bank-search').value : '');
}

function renderBankTxList(search) {
  var el = document.getElementById('bank-tx-list');
  if (!el) return;
  var q = (search || '').toLowerCase();
  var filtered = _bankTxs.filter(function (t) {
    return !q || (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
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
          '<span class="tx-cat bank-cat-label" data-id="' + t.id + '">' + (t.category ? esc(t.category) : '<em>categorie instellen</em>') + '</span>' +
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
  var cats = ['Boodschappen', 'Restaurant', 'Transport', 'Loon', 'Huur', 'Nutsvoorzieningen',
              'Abonnement', 'Kleding', 'Gezondheid', 'Vrije tijd', 'Sparen', 'Overig'];
  if (typeof _userCats !== 'undefined') {
    _userCats.forEach(function (c) { if (!cats.includes(c.label)) cats.push(c.label); });
  }

  var html =
    '<p class="modal-title">Categorie instellen</p>' +
    '<div class="bank-cat-grid">';
  cats.forEach(function (cat) {
    html += '<button class="bank-cat-chip" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>';
  });
  html += '</div>' +
    '<button class="btn-ghost" style="margin:12px 0 4px;width:100%" id="bank-cat-clear">Verwijder categorie</button>';

  openModal(html);

  document.querySelectorAll('.bank-cat-chip').forEach(function (chip) {
    chip.addEventListener('click', async function () {
      await setCategory(txId, this.dataset.cat, labelEl);
      closeModal();
    });
  });
  document.getElementById('bank-cat-clear').addEventListener('click', async function () {
    await setCategory(txId, null, labelEl);
    closeModal();
  });
}

async function setCategory(txId, cat, labelEl) {
  var resp = await apiCall('PATCH', '/transactions/' + txId + '/category', { category: cat });
  if (!resp || !resp.ok) return;
  if (labelEl) labelEl.innerHTML = cat ? esc(cat) : '<em>categorie instellen</em>';
  var tx = _bankTxs.find(function (t) { return t.id === txId; });
  if (tx) tx.category = cat;
}
