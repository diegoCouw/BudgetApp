var _selCat = 'overig';

// ── Modal open/close ─────────────────────────────────────────────────────────
function showModal() {
  var ov = document.getElementById('moverlay');
  var sh = document.getElementById('msheet');
  ov.hidden = false;
  ov.style.opacity = '0';
  sh.style.transform = 'translateY(100%)';
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      ov.style.transition  = 'opacity .25s';
      sh.style.transition  = 'transform .3s cubic-bezier(.32,.72,0,1)';
      ov.style.opacity     = '1';
      sh.style.transform   = 'translateY(0)';
    });
  });
}

function closeModal() {
  var ov = document.getElementById('moverlay');
  var sh = document.getElementById('msheet');
  ov.style.opacity   = '0';
  sh.style.transform = 'translateY(100%)';
  setTimeout(function () {
    ov.hidden = true;
    ov.style.transition = '';
    sh.style.transition = '';
  }, 300);
}

// ── Add transaction ───────────────────────────────────────────────────────────
function openAdd() {
  var txType = 'expense';
  _selCat = 'overig';

  function buildForm(savedAmt, savedDate, savedDesc) {
    savedAmt  = savedAmt  || '';
    savedDate = savedDate || todayISO();
    savedDesc = savedDesc || '';

    var allCats = getCatList();
    var catBtns = allCats.map(function (c) {
      var short = c.label.length > 9 ? c.label.slice(0, 8) + '…' : c.label;
      return '<button class="cat-btn' + (c.id === _selCat ? ' sel' : '') +
        '" data-cat="' + c.id + '" type="button">' +
        '<span class="emo">' + c.emoji + '</span>' +
        '<span>' + short + '</span>' +
      '</button>';
    }).join('');

    var isExpense  = txType === 'expense';
    var isIncome   = txType === 'income';
    var isTransfer = txType === 'transfer';

    document.getElementById('mcontent').innerHTML =
      '<h2 class="mtitle">Transactie toevoegen</h2>' +
      '<div class="type-toggle">' +
        '<button id="tt-expense" class="' + (isExpense  ? 'active' : '') + '" type="button">↓ Uitgave</button>' +
        '<button id="tt-income"  class="' + (isIncome   ? 'active income-sel' : '') + '" type="button">↑ Inkomst</button>' +
        '<button id="tt-transfer" class="' + (isTransfer ? 'active transfer-sel' : '') + '" type="button">⇄ Overschrijving</button>' +
      '</div>' +

      (isTransfer ? _buildTransferForm(savedAmt, savedDate, savedDesc) : _buildTxForm(isExpense, catBtns, savedAmt, savedDate, savedDesc)) +

      '<button class="btn-primary" id="save-btn">Opslaan</button>';

    // Wire type toggle
    function wireToggle(id, type) {
      document.getElementById(id).addEventListener('click', function () {
        if (txType !== type) {
          var a = document.getElementById('amt-in') || document.getElementById('trans-amt');
          var curAmt  = a ? a.value : '';
          var curDate = (document.getElementById('date-in')  || {}).value || todayISO();
          var curDesc = (document.getElementById('desc-in')  || {}).value || '';
          txType = type;
          if (type !== 'expense') _selCat = 'overig';
          buildForm(curAmt, curDate, curDesc);
        }
      });
    }
    wireToggle('tt-expense', 'expense');
    wireToggle('tt-income', 'income');
    wireToggle('tt-transfer', 'transfer');

    // Category grid (expense only)
    if (isExpense) {
      document.getElementById('cg').addEventListener('click', function (e) {
        var btn = e.target.closest('.cat-btn');
        if (!btn) return;
        _selCat = btn.dataset.cat;
        document.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
      });
    }

    // Save
    document.getElementById('save-btn').addEventListener('click', async function () {
      if (isTransfer) { await _saveTransfer(); return; }

      var amtIn  = document.getElementById('amt-in');
      var dateIn = document.getElementById('date-in');
      var descIn = document.getElementById('desc-in');
      var amount = parseFloat(amtIn.value.replace(',', '.'));
      var date   = dateIn.value;
      var desc   = descIn.value.trim();

      if (!amount || amount <= 0) {
        document.getElementById('amtwrap').style.borderColor = 'var(--danger)';
        amtIn.focus(); return;
      }
      if (!date) return;

      // Guard: zichtrekening cannot go negative on expense
      if ((txType || 'expense') === 'expense' && typeof _accounts !== 'undefined') {
        var allTx2  = await getAllTxs();
        var zicht   = _accounts.find(function (a) { return a.type === 'zicht'; });
        if (zicht) {
          var curBal = _calcAccountBalance(zicht, allTx2);
          if (curBal - amount < 0) {
            document.getElementById('amtwrap').style.borderColor = 'var(--danger)';
            var errEl = document.getElementById('bal-err');
            if (!errEl) {
              errEl = document.createElement('div');
              errEl.id = 'bal-err';
              errEl.style.cssText = 'color:var(--danger);font-size:13px;margin-top:6px;text-align:center;';
              document.getElementById('amtwrap').insertAdjacentElement('afterend', errEl);
            }
            errEl.textContent = 'Onvoldoende saldo (beschikbaar: ' + eur(curBal) + ')';
            return;
          }
        }
      }

      var tagsRaw = document.getElementById('tags-in') ? document.getElementById('tags-in').value : '';
      var tags    = tagsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

      var parts = date.split('-').map(Number);
      var y = parts[0], m = parts[1];

      await addTx({
        amount: Math.round(amount * 100) / 100,
        cat:    isIncome ? 'inkomst' : _selCat,
        date:   date,
        ym:     ymKey(y, m - 1),
        desc:   desc,
        ts:     Date.now(),
        type:   txType,
        tags:   tags,
      });

      closeModal();
      curY = y;
      curM = m - 1;
      await render();
    });

    setTimeout(function () {
      var inp = document.getElementById('amt-in') || document.getElementById('trans-amt');
      if (inp) inp.focus();
    }, 80);
  }

  buildForm();
  showModal();
}

function _buildTxForm(isExpense, catBtns, savedAmt, savedDate, savedDesc, savedTags) {
  var placeholder = isExpense ? 'Bijv. Albert Heijn' : 'Bijv. Loon';
  var tagsVal = savedTags && savedTags.length ? savedTags.join(', ') : '';
  return '<div class="amt-wrap" id="amtwrap">' +
      '<span class="amt-sign">€</span>' +
      '<input id="amt-in" type="number" inputmode="decimal" placeholder="0,00" step="0.01" min="0" value="' + savedAmt + '">' +
    '</div>' +
    (isExpense ? '<div class="field-lbl">Categorie</div><div class="cat-grid" id="cg">' + catBtns + '</div>' : '') +
    '<div class="field">' +
      '<div class="field-lbl">Datum</div>' +
      '<input class="form-in" type="date" id="date-in" value="' + savedDate + '">' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">' + (isExpense ? 'Omschrijving' : 'Bron') + ' (optioneel)</div>' +
      '<input class="form-in" type="text" id="desc-in" placeholder="' + placeholder + '" maxlength="80" value="' + esc(savedDesc) + '">' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Tags (optioneel, kommagescheiden)</div>' +
      '<input class="form-in" type="text" id="tags-in" placeholder="Bijv. vakantie, werk" maxlength="120" value="' + esc(tagsVal) + '">' +
    '</div>';
}

function _buildTransferForm(savedAmt, savedDate, savedDesc) {
  // Accounts loaded globally as _accounts (populated at boot)
  var accs     = typeof _accounts !== 'undefined' ? _accounts : [];
  var zicht    = accs.find(function (a) { return a.type === 'zicht'; });
  var spaar    = accs.filter(function (a) { return a.type === 'spaar'; });

  var fromOpts = accs.map(function (a) {
    var def = zicht && a.id === zicht.id;
    return '<option value="' + a.id + '"' + (def ? ' selected' : '') + '>' + esc(a.name) + '</option>';
  }).join('');

  var toOpts = accs.map(function (a) {
    var def = spaar.length > 0 && a.id === spaar[0].id;
    return '<option value="' + a.id + '"' + (def ? ' selected' : '') + '>' + esc(a.name) + '</option>';
  }).join('');

  if (!accs.length) {
    return '<div style="padding:14px;text-align:center;color:var(--muted);font-size:14px;">' +
      'Voeg eerst rekeningen toe via Instellingen → Rekeningen.</div>';
  }

  return '<div class="amt-wrap" id="amtwrap">' +
      '<span class="amt-sign">€</span>' +
      '<input id="trans-amt" type="number" inputmode="decimal" placeholder="0,00" step="0.01" min="0" value="' + savedAmt + '">' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Van</div>' +
      '<select class="form-in" id="trans-from">' + fromOpts + '</select>' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Naar</div>' +
      '<select class="form-in" id="trans-to">' + toOpts + '</select>' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Datum</div>' +
      '<input class="form-in" type="date" id="date-in" value="' + savedDate + '">' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Omschrijving (optioneel)</div>' +
      '<input class="form-in" type="text" id="desc-in" placeholder="Bijv. Sparen" maxlength="80" value="' + esc(savedDesc) + '">' +
    '</div>';
}

async function _saveTransfer() {
  var amtEl  = document.getElementById('trans-amt');
  var fromEl = document.getElementById('trans-from');
  var toEl   = document.getElementById('trans-to');
  var dateEl = document.getElementById('date-in');
  var descEl = document.getElementById('desc-in');

  if (!amtEl) return;

  var amount = parseFloat(amtEl.value.replace(',', '.'));
  var fromId = Number(fromEl.value);
  var toId   = Number(toEl.value);
  var date   = dateEl.value;
  var desc   = descEl.value.trim();

  if (!amount || amount <= 0) {
    document.getElementById('amtwrap').style.borderColor = 'var(--danger)';
    amtEl.focus(); return;
  }
  if (!date || fromId === toId) return;

  // Guard: source account cannot go negative on transfer
  if (typeof _accounts !== 'undefined') {
    var allTxT   = await getAllTxs();
    var fromAccT = _accounts.find(function (a) { return a.id === fromId; });
    if (fromAccT) {
      var fromBal = _calcAccountBalance(fromAccT, allTxT);
      if (fromBal - amount < 0) {
        document.getElementById('amtwrap').style.borderColor = 'var(--danger)';
        var tErrEl = document.getElementById('bal-err');
        if (!tErrEl) {
          tErrEl = document.createElement('div');
          tErrEl.id = 'bal-err';
          tErrEl.style.cssText = 'color:var(--danger);font-size:13px;margin-top:6px;text-align:center;';
          document.getElementById('amtwrap').insertAdjacentElement('afterend', tErrEl);
        }
        tErrEl.textContent = 'Onvoldoende saldo op bronrekening (beschikbaar: ' + eur(fromBal) + ')';
        return;
      }
    }
  }

  var parts = date.split('-').map(Number);
  var y = parts[0], m = parts[1];

  await addTx({
    amount: Math.round(amount * 100) / 100,
    cat:    'transfer',
    date:   date,
    ym:     ymKey(y, m - 1),
    desc:   desc || 'Overschrijving',
    ts:     Date.now(),
    type:   'transfer',
    fromAccountId: fromId,
    toAccountId:   toId,
  });

  closeModal();
  curY = y;
  curM = m - 1;
  await render();
}

// ── Transaction detail ────────────────────────────────────────────────────────
function openDetail(id, txs) {
  var tx = txs.find(function (t) { return t.id === id; });
  if (!tx) return;

  var isIncome   = tx.type === 'income';
  var isTransfer = tx.type === 'transfer';
  var c;
  if (isIncome)        c = { emoji: '💰', label: 'Inkomst',       color: '#22C55E' };
  else if (isTransfer) c = { emoji: '⇄',         label: 'Overschrijving', color: '#6366F1' };
  else                 c = catById(tx.cat);

  _renderDetail(tx, c, false);
  showModal();
}

function _renderDetail(tx, c, confirming) {
  var isIncome   = tx.type === 'income';
  var isTransfer = tx.type === 'transfer';

  var confirmBlock = confirming
    ? '<div style="margin-top:16px;padding:14px;background:var(--danger-t);border-radius:14px;font-size:14px;color:var(--danger);text-align:center;margin-bottom:4px;">Weet je zeker dat je deze transactie wil verwijderen?</div>' +
      '<button class="btn-danger" id="confirm-del">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>' +
        'Ja, verwijderen</button>' +
      '<button class="btn-ghost" id="cancel-del">Annuleren</button>'
    : (!isTransfer
        ? '<button class="btn-ghost" id="edit-btn" style="margin-bottom:8px;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
            'Bewerken</button>'
        : '') +
      '<button class="btn-danger" id="del-btn">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>' +
        'Verwijderen</button>';

  var amtClass  = isIncome ? ' income' : (isTransfer ? ' transfer-amt' : '');
  var amtPrefix = isIncome ? '+' : '';

  var transferInfo = '';
  if (isTransfer && typeof _accounts !== 'undefined') {
    var fromAcc = _accounts.find(function (a) { return a.id === tx.fromAccountId; });
    var toAcc   = _accounts.find(function (a) { return a.id === tx.toAccountId; });
    if (fromAcc && toAcc) {
      transferInfo = '<div class="detail-row">' + esc(fromAcc.name) + ' → ' + esc(toAcc.name) + '</div>';
    }
  }

  document.getElementById('mcontent').innerHTML =
    '<h2 class="mtitle">Transactie</h2>' +
    '<div class="detail-hero">' +
      '<div class="detail-icon" style="background:' + c.color + '1a">' + c.emoji + '</div>' +
      '<div>' +
        '<div class="detail-cat">' + c.label + '</div>' +
        '<div class="detail-amt' + amtClass + '">' + amtPrefix + eur(tx.amount) + '</div>' +
      '</div>' +
    '</div>' +
    (tx.desc ? '<div class="detail-row"><strong>' + esc(tx.desc) + '</strong></div>' : '') +
    transferInfo +
    '<div class="detail-row">' + fmtDay(tx.date) + '</div>' +
    confirmBlock;

  if (confirming) {
    document.getElementById('confirm-del').addEventListener('click', async function () {
      await delTx(tx.id);
      closeModal();
      await render();
    });
    document.getElementById('cancel-del').addEventListener('click', function () {
      _renderDetail(tx, c, false);
    });
  } else {
    if (!isTransfer && document.getElementById('edit-btn')) {
      document.getElementById('edit-btn').addEventListener('click', function () {
        openEdit(tx);
      });
    }
    document.getElementById('del-btn').addEventListener('click', function () {
      _renderDetail(tx, c, true);
    });
  }
}

// ── Edit transaction ──────────────────────────────────────────────────────────
function openEdit(tx) {
  var isExpense = (tx.type || 'expense') === 'expense';
  _selCat = tx.cat || 'overig';

  function buildEditForm(confirming, pendingData) {
    var html = '<h2 class="mtitle">Transactie bewerken</h2>';

    if (confirming && pendingData) {
      html +=
        '<div style="margin:0 0 16px;padding:14px;background:var(--surface2,var(--surface));border-radius:14px;font-size:14px;">' +
          '<div style="font-weight:600;margin-bottom:4px;">Wijziging opslaan?</div>' +
          '<div style="color:var(--muted);">' + eur(pendingData.amount) + ' · ' + fmtDay(pendingData.date) + '</div>' +
        '</div>' +
        '<button class="btn-primary" id="confirm-edit-btn">Ja, opslaan</button>' +
        '<button class="btn-ghost" id="cancel-confirm-btn" style="margin-top:8px;">Terug</button>';

      document.getElementById('mcontent').innerHTML = html;

      document.getElementById('confirm-edit-btn').addEventListener('click', async function () {
        await updateTx(tx.id, pendingData);
        closeModal();
        await render();
      });
      document.getElementById('cancel-confirm-btn').addEventListener('click', function () {
        buildEditForm(false, null);
      });
      return;
    }

    var allCats = getCatList();
    var catBtns = isExpense ? allCats.map(function (c) {
      var short = c.label.length > 9 ? c.label.slice(0, 8) + '…' : c.label;
      return '<button class="cat-btn' + (c.id === _selCat ? ' sel' : '') +
        '" data-cat="' + c.id + '" type="button">' +
        '<span class="emo">' + c.emoji + '</span><span>' + short + '</span></button>';
    }).join('') : '';

    html +=
      '<div class="amt-wrap" id="amtwrap">' +
        '<span class="amt-sign">€</span>' +
        '<input id="amt-in" type="number" inputmode="decimal" placeholder="0,00" step="0.01" min="0" value="' + tx.amount + '">' +
      '</div>' +
      (isExpense ? '<div class="field-lbl">Categorie</div><div class="cat-grid" id="cg">' + catBtns + '</div>' : '') +
      '<div class="field"><div class="field-lbl">Datum</div>' +
        '<input class="form-in" type="date" id="date-in" value="' + tx.date + '">' +
      '</div>' +
      '<div class="field"><div class="field-lbl">Omschrijving (optioneel)</div>' +
        '<input class="form-in" type="text" id="desc-in" placeholder="Bijv. Albert Heijn" maxlength="80" value="' + esc(tx.desc || '') + '">' +
      '</div>' +
      '<div class="field"><div class="field-lbl">Tags (optioneel, kommagescheiden)</div>' +
        '<input class="form-in" type="text" id="tags-in" placeholder="Bijv. vakantie, werk" maxlength="120" value="' + esc((tx.tags || []).join(', ')) + '">' +
      '</div>' +
      '<button class="btn-primary" id="save-edit-btn">Bewerken</button>';

    document.getElementById('mcontent').innerHTML = html;

    if (isExpense) {
      document.getElementById('cg').addEventListener('click', function (e) {
        var btn = e.target.closest('.cat-btn');
        if (!btn) return;
        _selCat = btn.dataset.cat;
        document.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
      });
    }

    document.getElementById('save-edit-btn').addEventListener('click', function () {
      var amount   = parseFloat(document.getElementById('amt-in').value.replace(',', '.'));
      var date     = document.getElementById('date-in').value;
      var desc     = (document.getElementById('desc-in') || {}).value || '';
      desc = desc.trim ? desc.trim() : desc;
      var tagsRaw2 = document.getElementById('tags-in') ? document.getElementById('tags-in').value : '';
      var tags2    = tagsRaw2.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

      if (!amount || amount <= 0) {
        document.getElementById('amtwrap').style.borderColor = 'var(--danger)';
        document.getElementById('amt-in').focus(); return;
      }
      if (!date) return;

      var parts = date.split('-').map(Number);
      buildEditForm(true, {
        amount: Math.round(amount * 100) / 100,
        cat:    _selCat,
        date:   date,
        ym:     ymKey(parts[0], parts[1] - 1),
        desc:   desc,
        ts:     tx.ts,
        type:   tx.type || 'expense',
        tags:   tags2,
      });
    });
  }

  buildEditForm(false, null);
  showModal();
}

// ── Rollover dialog ───────────────────────────────────────────────────────────
function openRollover(surplus, prevYm, onDone) {
  var spaarAccs = (typeof _accounts !== 'undefined' ? _accounts : [])
    .filter(function (a) { return a.type === 'spaar'; });

  function markDone(action) {
    try {
      var stored = JSON.parse(localStorage.getItem('budget_rollover') || '{}');
      stored[prevYm] = action;
      localStorage.setItem('budget_rollover', JSON.stringify(stored));
    } catch (e) {}
    closeModal();
    if (typeof onDone === 'function') onDone();
  }

  function buildMain() {
    var mnlName = prevYm.split('-');
    var label   = mnlName[1] ? (MNL[Number(mnlName[1]) - 1] || prevYm) + ' ' + mnlName[0] : prevYm;

    var spaarHtml = spaarAccs.length
      ? spaarAccs.map(function (a) {
          return '<button class="btn-ghost rollover-spaar" data-id="' + a.id +
            '" style="margin-top:8px;">' + esc(a.name) + '</button>';
        }).join('')
      : '<div style="color:var(--muted);font-size:13px;margin-top:4px;">Geen spaarrekeningen aangemaakt.</div>';

    document.getElementById('mcontent').innerHTML =
      '<h2 class="mtitle">Maandoverschot ' + esc(label) + '</h2>' +
      '<div style="text-align:center;font-size:28px;font-weight:700;color:var(--accent);margin:8px 0 20px;">' + eur(surplus) + '</div>' +
      '<p style="font-size:14px;color:var(--muted);margin:0 0 16px;">Je had vorige maand een overschot. Wat wil je hiermee doen?</p>' +
      '<button class="btn-primary" id="rollover-carry">Meenemen naar deze maand</button>' +
      '<div style="margin:12px 0 4px;font-size:13px;font-weight:600;color:var(--muted);">Naar spaarrekening</div>' +
      spaarHtml +
      '<button class="btn-ghost" id="rollover-ignore" style="margin-top:16px;color:var(--muted);">Negeren</button>';

    document.getElementById('rollover-carry').addEventListener('click', async function () {
      var today   = todayISO();
      var parts   = today.split('-').map(Number);
      await addTx({
        amount: Math.round(surplus * 100) / 100,
        cat:    'inkomst',
        date:   today,
        ym:     ymKey(parts[0], parts[1] - 1),
        desc:   'Overschot ' + prevYm,
        ts:     Date.now(),
        type:   'income',
      });
      markDone('carry');
      await render();
    });

    document.getElementById('rollover-ignore').addEventListener('click', function () {
      markDone('ignore');
    });

    document.querySelectorAll('.rollover-spaar').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var toId   = Number(this.dataset.id);
        var zicht  = (typeof _accounts !== 'undefined' ? _accounts : [])
          .find(function (a) { return a.type === 'zicht'; });
        if (!zicht) { markDone('ignore'); return; }
        var today  = todayISO();
        var parts  = today.split('-').map(Number);
        await addTx({
          amount: Math.round(surplus * 100) / 100,
          cat:    'transfer',
          date:   today,
          ym:     ymKey(parts[0], parts[1] - 1),
          desc:   'Overschot ' + prevYm,
          ts:     Date.now(),
          type:   'transfer',
          fromAccountId: zicht.id,
          toAccountId:   toId,
        });
        markDone('spaar_' + toId);
        await render();
      });
    });
  }

  buildMain();
  showModal();
}

// ── Settings ──────────────────────────────────────────────────────────────────
function _settingsLink(id, icon, title, sub) {
  return '<div class="settings-link" id="' + id + '">' +
    '<div>' +
      '<div style="font-size:15px;font-weight:500;">' + icon + ' ' + title + '</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-top:2px;">' + sub + '</div>' +
    '</div>' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
  '</div>';
}

function openSettings() {
  document.getElementById('mcontent').innerHTML =
    '<h2 class="mtitle">Instellingen</h2>' +
    '<div class="card" style="margin-bottom:20px;"><div style="padding:0 16px;">' +
      '<div class="settings-row"><span>Versie</span><span>' + APP_VERSION + '</span></div>' +
      '<div class="settings-row"><span>Data opslag</span><span>Lokaal op dit apparaat</span></div>' +
    '</div></div>' +

    '<p class="field-lbl">Beheer</p>' +
    _settingsLink('link-goals',     '🎯', 'Doelstellingen',   'Budgetten en spaardoelen') +
    _settingsLink('link-cats',      '🏷️', 'Categorieën', 'Eigen categorieën toevoegen') +
    _settingsLink('link-accounts',  '🏦', 'Rekeningen',       'Zicht- en spaarrekeningen') +
    _settingsLink('link-recurring', '🔄', 'Domicilieringen',  'Vaste maandelijkse betalingen') +

    '<p class="field-lbl" style="margin-top:20px;">Updates</p>' +
    (updateWaiting
      ? '<div class="update-feedback ok" style="margin-bottom:10px;">Update gedownload — klaar om te installeren.</div>' +
        '<button class="btn-primary" id="check-upd-btn">Herladen om te installeren</button>'
      : '<button class="btn-primary" id="check-upd-btn">Controleren op updates</button>') +
    '<div id="upd-feedback"></div>' +

    '<p class="field-lbl" style="margin-top:20px;">Data beheer</p>' +
    '<button class="btn-primary" id="export-btn">Exporteer data (JSON)</button>' +
    '<button class="btn-ghost" id="export-csv-btn" style="margin-top:10px;">Exporteer als CSV</button>' +
    '<button class="btn-ghost" id="import-btn" style="margin-top:10px;">Importeer data</button>' +
    '<input type="file" id="import-file" accept=".json" style="display:none">' +
    '<div id="import-preview"></div>';

  document.getElementById('link-goals').addEventListener('click',     openGoalsSettings);
  document.getElementById('link-cats').addEventListener('click',      openCatsSettings);
  document.getElementById('link-accounts').addEventListener('click',  openAccountsSettings);
  document.getElementById('link-recurring').addEventListener('click', openRecurringSettings);

  document.getElementById('check-upd-btn').addEventListener('click', async function () {
    var btn = document.getElementById('check-upd-btn');
    var fb  = document.getElementById('upd-feedback');
    if (updateWaiting) { applyUpdate(); return; }
    btn.textContent = 'Bezig…'; btn.disabled = true; fb.innerHTML = '';
    var result = await checkUpdate();
    if (result === 'available') {
      updateWaiting = true;
      btn.textContent = 'Herladen om te installeren'; btn.disabled = false;
      fb.innerHTML = '<div class="update-feedback ok" style="margin-top:12px;">Update gedownload! Tik nogmaals om te herladen.</div>';
    } else if (result === 'uptodate') {
      btn.textContent = 'Controleren op updates'; btn.disabled = false;
      fb.innerHTML = '<div class="update-feedback ok" style="margin-top:12px;">Je hebt de nieuwste versie (' + APP_VERSION + ') ✓</div>';
    } else if (result === 'nosw') {
      btn.textContent = 'Controleren op updates'; btn.disabled = false;
      fb.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Updates werken alleen via GitHub Pages, niet via een lokaal bestand.</div>';
    } else {
      btn.textContent = 'Controleren op updates'; btn.disabled = false;
      fb.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Geen verbinding. Probeer het later opnieuw.</div>';
    }
  });

  document.getElementById('export-btn').addEventListener('click', async function () {
    var btn = document.getElementById('export-btn');
    btn.textContent = 'Bezig…'; btn.disabled = true;
    try {
      var txs  = await getAllTxs();
      var data = JSON.stringify({ version: APP_VERSION, exported: new Date().toISOString(), transactions: txs }, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.download = 'budget-backup-' + todayISO() + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {}
    btn.textContent = 'Exporteer data'; btn.disabled = false;
  });

  document.getElementById('export-csv-btn').addEventListener('click', async function () {
    var btn = document.getElementById('export-csv-btn');
    btn.textContent = 'Bezig…'; btn.disabled = true;
    try {
      var txs    = await getAllTxs();
      var catMap = getCatMap();
      var TYPE_NL = { expense: 'Uitgave', income: 'Inkomst', transfer: 'Overschrijving' };
      var rows = [['Datum', 'Type', 'Categorie', 'Omschrijving', 'Bedrag'].join(';')];
      txs.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (t) {
        var parts   = (t.date || '').split('-');
        var dateFmt = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : (t.date || '');
        var typeStr = TYPE_NL[t.type || 'expense'] || t.type;
        var cat     = catMap[t.cat] ? catMap[t.cat].label : (t.cat || '');
        var desc    = (t.desc || '').replace(/"/g, '""');
        var amt     = t.amount.toFixed(2).replace('.', ',');
        rows.push([dateFmt, typeStr, '"' + cat + '"', '"' + desc + '"', amt].join(';'));
      });
      var csv  = '﻿' + rows.join('\r\n'); // BOM for Excel nl-BE
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.download = 'budget-' + todayISO() + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {}
    btn.textContent = 'Exporteer als CSV'; btn.disabled = false;
  });

  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var preview = document.getElementById('import-preview');
      try {
        var parsed = JSON.parse(ev.target.result);
        if (!parsed.transactions || !Array.isArray(parsed.transactions)) throw new Error();
        var txs = parsed.transactions, count = txs.length;
        var dates = txs.map(function (t) { return t.date; }).filter(Boolean).sort();
        var range = dates.length ? dates[0] + ' t/m ' + dates[dates.length - 1] : '—';
        preview.innerHTML =
          '<div style="margin-top:16px;padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:14px;">' +
            '<div style="font-size:14px;margin-bottom:12px;">' +
              '<strong>' + count + ' transacties</strong><br>' +
              '<span style="color:var(--muted);font-size:13px;">' + range + '</span>' +
            '</div>' +
            '<button class="btn-ghost" id="merge-btn" style="margin-bottom:8px;">Samenvoegen</button>' +
            '<button class="btn-danger" id="replace-btn">Vervangen</button>' +
            '<div id="import-fb"></div>' +
          '</div>';
        document.getElementById('merge-btn').addEventListener('click', async function () {
          await _doImport(txs, false);
        });
        document.getElementById('replace-btn').addEventListener('click', function () {
          document.getElementById('import-fb').innerHTML =
            '<div style="margin-top:10px;padding:12px;background:var(--danger-t);border-radius:10px;font-size:13px;color:var(--danger);text-align:center;">Alle bestaande transacties worden gewist. Doorgaan?</div>' +
            '<button class="btn-danger" id="confirm-replace" style="margin-top:8px;">Ja, vervangen</button>' +
            '<button class="btn-ghost" id="cancel-replace" style="margin-top:8px;">Annuleren</button>';
          document.getElementById('confirm-replace').addEventListener('click', async function () { await _doImport(txs, true); });
          document.getElementById('cancel-replace').addEventListener('click', function () { document.getElementById('import-fb').innerHTML = ''; });
        });
      } catch (_) {
        preview.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Ongeldig bestand.</div>';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  showModal();
}

async function _doImport(txs, replace) {
  var fb = document.getElementById('import-fb') || document.getElementById('import-preview');
  try {
    if (replace) await clearAllTxs();
    await bulkAddTxs(txs);
    closeModal();
    await render();
  } catch (_) {
    if (fb) fb.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Import mislukt.</div>';
  }
}

// ── Goals settings ────────────────────────────────────────────────────────────
function openGoalsSettings() {
  async function refresh() {
    var goals  = await getAllRecords('goals');
    var catMap = getCatMap();
    document.getElementById('mcontent').innerHTML =
      _backBtn(openSettings) +
      '<h2 class="mtitle">Doelstellingen</h2>' +
      (goals.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:20px 0;font-size:14px;">Nog geen doelstellingen.</div>' : '') +
      goals.map(function (g) {
        var typeLabels = { category: 'Categorie', total: 'Maandtotaal', savings: 'Sparen', period: 'Periode' };
        var catName = g.catId && catMap[g.catId] ? catMap[g.catId].label : '';
        return '<div class="settings-item">' +
          '<div><div class="settings-item-label">' + esc(g.label) + '</div>' +
          '<div class="settings-item-sub">' + (typeLabels[g.type] || g.type) + (catName ? ' · ' + catName : '') + ' · ' + eur(g.amount) + '</div></div>' +
          '<button class="icon-btn-sm del-goal" data-id="' + g.id + '">🗑</button>' +
        '</div>';
      }).join('') +
      '<button class="btn-primary" id="add-goal-btn" style="margin-top:16px;">+ Doelstelling toevoegen</button>';

    document.getElementById('back-btn').addEventListener('click', openSettings);
    document.querySelectorAll('.del-goal').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        await delRecord('goals', Number(this.dataset.id));
        refresh();
      });
    });
    document.getElementById('add-goal-btn').addEventListener('click', function () { openAddGoal(refresh); });
  }
  refresh();
}

function openAddGoal(onSave) {
  var goalType = 'total';

  function buildForm(savedLabel, savedAmt) {
    savedLabel = savedLabel || '';
    savedAmt   = savedAmt   || '';
    var catList = getCatList();
    var typeOpts = [
      { v: 'total',    l: 'Totaal maandbudget' },
      { v: 'category', l: 'Per categorie' },
      { v: 'savings',  l: 'Spaardoelstelling' },
      { v: 'period',   l: 'Periode' },
    ];

    document.getElementById('mcontent').innerHTML =
      _backBtn(openGoalsSettings) +
      '<h2 class="mtitle">Doelstelling toevoegen</h2>' +
      '<div class="field"><div class="field-lbl">Type</div>' +
        '<select class="form-in" id="goal-type">' +
          typeOpts.map(function (o) { return '<option value="' + o.v + '"' + (o.v === goalType ? ' selected' : '') + '>' + o.l + '</option>'; }).join('') +
        '</select></div>' +
      '<div class="field"><div class="field-lbl">Label</div>' +
        '<input class="form-in" type="text" id="goal-label" placeholder="Bijv. Boodschappen" maxlength="40" value="' + esc(savedLabel) + '"></div>' +
      (goalType === 'category'
        ? '<div class="field"><div class="field-lbl">Categorie</div>' +
            '<select class="form-in" id="goal-cat">' +
              catList.map(function (c) { return '<option value="' + c.id + '">' + c.emoji + ' ' + c.label + '</option>'; }).join('') +
            '</select></div>'
        : '') +
      '<div class="field"><div class="field-lbl">Bedrag (€)</div>' +
        '<input class="form-in" type="number" id="goal-amount" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="' + savedAmt + '"></div>' +
      (goalType === 'period'
        ? '<div class="field"><div class="field-lbl">Van datum</div><input class="form-in" type="date" id="goal-from"></div>' +
          '<div class="field"><div class="field-lbl">Tot datum</div><input class="form-in" type="date" id="goal-to"></div>'
        : '') +
      '<button class="btn-primary" id="save-goal-btn">Opslaan</button>';

    document.getElementById('back-btn').addEventListener('click', openGoalsSettings);

    document.getElementById('goal-type').addEventListener('change', function () {
      var lbl = document.getElementById('goal-label').value;
      var amt = document.getElementById('goal-amount').value;
      goalType = this.value;
      buildForm(lbl, amt);
    });

    document.getElementById('save-goal-btn').addEventListener('click', async function () {
      var label  = document.getElementById('goal-label').value.trim();
      var amount = parseFloat(document.getElementById('goal-amount').value.replace(',', '.'));
      if (!label)              { document.getElementById('goal-label').focus();  return; }
      if (!amount || amount <= 0) { document.getElementById('goal-amount').focus(); return; }

      var catId = null;
      if (goalType === 'category') catId = document.getElementById('goal-cat').value;

      var dateFrom = null, dateTo = null;
      if (goalType === 'period') {
        dateFrom = document.getElementById('goal-from').value;
        dateTo   = document.getElementById('goal-to').value;
        if (!dateFrom || !dateTo) return;
      }

      await addRecord('goals', { label: label, type: goalType, catId: catId, amount: amount,
        period: goalType === 'period' ? 'custom' : 'monthly', dateFrom: dateFrom, dateTo: dateTo, active: true });

      openGoalsSettings();
    });
  }
  buildForm();
}

// ── Categories settings ───────────────────────────────────────────────────────
function openCatsSettings() {
  async function refresh() {
    var userCatRecs = await getAllRecords('categories');
    document.getElementById('mcontent').innerHTML =
      _backBtn(openSettings) +
      '<h2 class="mtitle">Categorieën</h2>' +
      '<p class="field-lbl" style="margin-bottom:12px;">Ingebouwd</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">' +
        CATS.map(function (c) {
          return '<div style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:13px;">' +
            c.emoji + ' ' + esc(c.label) + '</div>';
        }).join('') +
      '</div>' +
      (userCatRecs.length
        ? '<p class="field-lbl" style="margin-bottom:12px;">Eigen</p>' +
          userCatRecs.map(function (c) {
            return '<div class="settings-item">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="font-size:22px;">' + esc(c.emoji) + '</span>' +
                '<div><div class="settings-item-label">' + esc(c.label) + '</div>' +
                '<div class="settings-item-sub" style="display:flex;align-items:center;gap:5px;">' +
                  '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + esc(c.color) + '"></span>' +
                  esc(c.color) + '</div></div>' +
              '</div>' +
              '<button class="icon-btn-sm del-cat" data-dbid="' + c.id + '">🗑</button>' +
            '</div>';
          }).join('')
        : '') +
      '<button class="btn-primary" id="add-cat-btn" style="margin-top:16px;">+ Categorie toevoegen</button>';

    document.getElementById('back-btn').addEventListener('click', openSettings);
    document.querySelectorAll('.del-cat').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var dbId = Number(this.dataset.dbid);
        await delRecord('categories', dbId);
        _userCats = _userCats.filter(function (c) { return c.dbId !== dbId; });
        refresh();
      });
    });
    document.getElementById('add-cat-btn').addEventListener('click', openAddCat);
  }
  refresh();
}

function openAddCat() {
  var selColor = CAT_COLORS[0];

  document.getElementById('mcontent').innerHTML =
    _backBtn(openCatsSettings) +
    '<h2 class="mtitle">Categorie toevoegen</h2>' +
    '<div class="field"><div class="field-lbl">Naam</div>' +
      '<input class="form-in" type="text" id="cat-label" placeholder="Bijv. Sport" maxlength="20"></div>' +
    '<div class="field"><div class="field-lbl">Emoji</div>' +
      '<input class="form-in" type="text" id="cat-emoji" placeholder="🏃" maxlength="4" style="font-size:24px;text-align:center;"></div>' +
    '<div class="field"><div class="field-lbl">Kleur</div>' +
      '<div class="color-grid">' +
        CAT_COLORS.map(function (col) {
          return '<div class="color-swatch' + (col === selColor ? ' sel' : '') + '" style="background:' + col + '" data-color="' + col + '"></div>';
        }).join('') +
      '</div></div>' +
    '<button class="btn-primary" id="save-cat-btn">Opslaan</button>';

  document.getElementById('back-btn').addEventListener('click', openCatsSettings);

  document.querySelectorAll('.color-swatch').forEach(function (sw) {
    sw.addEventListener('click', function () {
      selColor = this.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('sel'); });
      this.classList.add('sel');
    });
  });

  document.getElementById('save-cat-btn').addEventListener('click', async function () {
    var label = document.getElementById('cat-label').value.trim();
    var emoji = document.getElementById('cat-emoji').value.trim();
    if (!label) { document.getElementById('cat-label').focus(); return; }
    if (!emoji) { document.getElementById('cat-emoji').focus(); return; }

    var dbId = await addRecord('categories', { label: label, emoji: emoji, color: selColor });
    _userCats.push({ id: 'u_' + dbId, dbId: dbId, label: label, emoji: emoji, color: selColor });
    openCatsSettings();
  });
}

// ── Accounts settings ─────────────────────────────────────────────────────────
function openAccountsSettings() {
  async function refresh() {
    var accs  = await getAllRecords('accounts');
    var allTx = await getAllTxs();
    _accounts = accs;

    document.getElementById('mcontent').innerHTML =
      _backBtn(openSettings) +
      '<h2 class="mtitle">Rekeningen</h2>' +
      (accs.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:20px 0;font-size:14px;">Geen rekeningen gevonden.</div>' : '') +
      accs.map(function (a) {
        var bal     = _calcAccountBalance(a, allTx);
        var balCol  = bal >= 0 ? '#22C55E' : 'var(--danger)';
        var typeStr = a.type === 'zicht' ? 'Zichtrekening' : 'Spaarrekening';
        return '<div class="settings-item">' +
          '<div><div class="settings-item-label">' + esc(a.name) + '</div>' +
            '<div class="settings-item-sub">' + typeStr + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="font-weight:700;font-size:15px;color:' + balCol + ';white-space:nowrap;">' + eur(bal) + '</span>' +
            (a.type !== 'zicht' ? '<button class="icon-btn-sm del-acc" data-id="' + a.id + '">🗑</button>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
      '<button class="btn-primary" id="add-acc-btn" style="margin-top:16px;">+ Spaarrekening toevoegen</button>';

    document.getElementById('back-btn').addEventListener('click', openSettings);
    document.querySelectorAll('.del-acc').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var accId = Number(this.dataset.id);
        var acc   = _accounts.find(function (a) { return a.id === accId; });
        if (acc) {
          var allTx = await getAllTxs();
          var bal   = _calcAccountBalance(acc, allTx);
          if (bal > 0) {
            var row = this.closest('.settings-item');
            if (row && !row.querySelector('.acc-err')) {
              var err = document.createElement('div');
              err.className = 'acc-err';
              err.style.cssText = 'color:var(--danger);font-size:12px;margin-top:4px;';
              err.textContent = 'Verplaats eerst het saldo (' + eur(bal) + ') voor je deze rekening verwijdert.';
              row.appendChild(err);
            }
            return;
          }
        }
        await delRecord('accounts', accId);
        _accounts = _accounts.filter(function (a) { return a.id !== accId; });
        refresh();
      });
    });
    document.getElementById('add-acc-btn').addEventListener('click', openAddAccount);
  }
  refresh();
}

function _calcAccountBalance(account, allTxs) {
  var bal = account.startBalance || 0;
  if (account.type === 'zicht') {
    allTxs.forEach(function (t) {
      if (t.type === 'income')   bal += t.amount;
      else if ((t.type || 'expense') === 'expense') bal -= t.amount;
      else if (t.type === 'transfer') {
        if (t.fromAccountId === account.id) bal -= t.amount;
        if (t.toAccountId   === account.id) bal += t.amount;
      }
    });
  } else {
    allTxs.forEach(function (t) {
      if (t.type === 'transfer') {
        if (t.fromAccountId === account.id) bal -= t.amount;
        if (t.toAccountId   === account.id) bal += t.amount;
      }
    });
  }
  return bal;
}

function openAddAccount() {
  document.getElementById('mcontent').innerHTML =
    _backBtn(openAccountsSettings) +
    '<h2 class="mtitle">Spaarrekening toevoegen</h2>' +
    '<div class="field"><div class="field-lbl">Naam</div>' +
      '<input class="form-in" type="text" id="acc-name" placeholder="Bijv. BNP Spaarrekening" maxlength="40"></div>' +
    '<div class="field"><div class="field-lbl">Huidig saldo (€)</div>' +
      '<input class="form-in" type="number" id="acc-balance" inputmode="decimal" step="0.01" placeholder="0.00"></div>' +
    '<button class="btn-primary" id="save-acc-btn">Opslaan</button>';

  document.getElementById('back-btn').addEventListener('click', openAccountsSettings);
  document.getElementById('save-acc-btn').addEventListener('click', async function () {
    var name    = document.getElementById('acc-name').value.trim();
    var balance = parseFloat(document.getElementById('acc-balance').value.replace(',', '.')) || 0;
    if (!name) { document.getElementById('acc-name').focus(); return; }
    var id = await addRecord('accounts', { name: name, type: 'spaar', startBalance: balance });
    _accounts.push({ id: id, name: name, type: 'spaar', startBalance: balance });
    openAccountsSettings();
  });
}

// ── Recurring payments ────────────────────────────────────────────────────────
function openRecurringSettings() {
  async function refresh() {
    var items  = await getAllRecords('recurring');
    var catMap = getCatMap();
    document.getElementById('mcontent').innerHTML =
      _backBtn(openSettings) +
      '<h2 class="mtitle">Domicilieringen</h2>' +
      (items.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:20px 0;font-size:14px;">Geen vaste betalingen.</div>' : '') +
      items.map(function (item) {
        var c = catMap[item.cat] || catMap['overig'];
        return '<div class="settings-item">' +
          '<div><div class="settings-item-label">' + c.emoji + ' ' + esc(item.desc || c.label) + '</div>' +
            '<div class="settings-item-sub">' + eur(item.amount) + ' · dag ' + item.dayOfMonth + ' van de maand</div></div>' +
          '<button class="icon-btn-sm del-rec" data-id="' + item.id + '">🗑</button>' +
        '</div>';
      }).join('') +
      '<button class="btn-primary" id="add-rec-btn" style="margin-top:16px;">+ Vaste betaling toevoegen</button>';

    document.getElementById('back-btn').addEventListener('click', openSettings);
    document.querySelectorAll('.del-rec').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        await delRecord('recurring', Number(this.dataset.id));
        refresh();
      });
    });
    document.getElementById('add-rec-btn').addEventListener('click', openAddRecurring);
  }
  refresh();
}

function openAddRecurring() {
  var selRecCat = 'overig';
  var allCats   = getCatList();

  var catBtns = allCats.map(function (c) {
    var short = c.label.length > 9 ? c.label.slice(0, 8) + '…' : c.label;
    return '<button class="cat-btn' + (c.id === selRecCat ? ' sel' : '') +
      '" data-cat="' + c.id + '" type="button">' +
      '<span class="emo">' + c.emoji + '</span>' +
      '<span>' + short + '</span>' +
    '</button>';
  }).join('');

  document.getElementById('mcontent').innerHTML =
    _backBtn(openRecurringSettings) +
    '<h2 class="mtitle">Vaste betaling toevoegen</h2>' +
    '<div class="amt-wrap" id="amtwrap-rec">' +
      '<span class="amt-sign">€</span>' +
      '<input id="rec-amount" type="number" inputmode="decimal" placeholder="0,00" step="0.01" min="0">' +
    '</div>' +
    '<div class="field-lbl">Categorie</div>' +
    '<div class="cat-grid" id="cg-rec">' + catBtns + '</div>' +
    '<div class="field"><div class="field-lbl">Omschrijving</div>' +
      '<input class="form-in" type="text" id="rec-desc" placeholder="Bijv. Huurprijs" maxlength="80"></div>' +
    '<div class="field"><div class="field-lbl">Dag van de maand (1–31)</div>' +
      '<input class="form-in" type="number" id="rec-day" min="1" max="31" value="1"></div>' +
    '<button class="btn-primary" id="save-rec-btn">Opslaan</button>';

  document.getElementById('back-btn').addEventListener('click', openRecurringSettings);

  document.getElementById('cg-rec').addEventListener('click', function (e) {
    var btn = e.target.closest('.cat-btn');
    if (!btn) return;
    selRecCat = btn.dataset.cat;
    document.querySelectorAll('#cg-rec .cat-btn').forEach(function (b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
  });

  document.getElementById('save-rec-btn').addEventListener('click', async function () {
    var amount = parseFloat(document.getElementById('rec-amount').value.replace(',', '.'));
    var desc   = document.getElementById('rec-desc').value.trim();
    var day    = parseInt(document.getElementById('rec-day').value);
    if (!amount || amount <= 0) { document.getElementById('amtwrap-rec').style.borderColor = 'var(--danger)'; return; }
    if (!day || day < 1 || day > 31) return;
    await addRecord('recurring', { amount: Math.round(amount * 100) / 100, cat: selRecCat, desc: desc, dayOfMonth: day, lastProcessedYM: null });
    openRecurringSettings();
  });
}

// ── Helper: back button HTML ──────────────────────────────────────────────────
function _backBtn(target) {
  return '<button class="btn-ghost" id="back-btn" style="width:auto;padding:8px 14px;margin:0 0 16px;">← Terug</button>';
}
