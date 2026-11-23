var _selCat = 'overig';

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

function openAdd() {
  _selCat = 'overig';

  var catBtns = CATS.map(function (c) {
    var short = c.label.length > 9 ? c.label.slice(0, 8) + '…' : c.label;
    return '<button class="cat-btn' + (c.id === _selCat ? ' sel' : '') +
      '" data-cat="' + c.id + '" type="button">' +
      '<span class="emo">' + c.emoji + '</span>' +
      '<span>' + short + '</span>' +
    '</button>';
  }).join('');

  document.getElementById('mcontent').innerHTML =
    '<h2 class="mtitle">Transactie toevoegen</h2>' +
    '<div class="amt-wrap" id="amtwrap">' +
      '<span class="amt-sign">€</span>' +
      '<input id="amt-in" type="number" inputmode="decimal" placeholder="0,00" step="0.01" min="0">' +
    '</div>' +
    '<div class="field-lbl">Categorie</div>' +
    '<div class="cat-grid" id="cg">' + catBtns + '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Datum</div>' +
      '<input class="form-in" type="date" id="date-in" value="' + todayISO() + '">' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-lbl">Omschrijving (optioneel)</div>' +
      '<input class="form-in" type="text" id="desc-in" placeholder="Bijv. Albert Heijn" maxlength="80">' +
    '</div>' +
    '<button class="btn-primary" id="save-btn">Opslaan</button>';

  document.getElementById('cg').addEventListener('click', function (e) {
    var btn = e.target.closest('.cat-btn');
    if (!btn) return;
    _selCat = btn.dataset.cat;
    document.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
  });

  document.getElementById('save-btn').addEventListener('click', async function () {
    var rawVal = document.getElementById('amt-in').value.replace(',', '.');
    var amount = parseFloat(rawVal);
    var date   = document.getElementById('date-in').value;
    var desc   = document.getElementById('desc-in').value.trim();

    if (!amount || amount <= 0) {
      document.getElementById('amtwrap').style.borderColor = 'var(--danger)';
      document.getElementById('amt-in').focus();
      return;
    }
    if (!date) return;

    var parts = date.split('-').map(Number);
    var y = parts[0], m = parts[1];

    await addTx({
      amount: Math.round(amount * 100) / 100,
      cat:    _selCat,
      date:   date,
      ym:     ymKey(y, m - 1),
      desc:   desc,
      ts:     Date.now(),
    });

    closeModal();
    curY = y;
    curM = m - 1;
    await render();
  });

  showModal();
  setTimeout(function () {
    var inp = document.getElementById('amt-in');
    if (inp) inp.focus();
  }, 120);
}

function openDetail(id, txs) {
  var tx = txs.find(function (t) { return t.id === id; });
  if (!tx) return;
  _renderDetail(tx, CMAP[tx.cat] || CMAP['overig'], false);
  showModal();
}

function _renderDetail(tx, c, confirming) {
  var confirmBlock = confirming
    ? '<div style="margin-top:16px;padding:14px;background:var(--danger-t);border-radius:14px;font-size:14px;color:var(--danger);text-align:center;margin-bottom:4px;">Weet je zeker dat je deze transactie wil verwijderen?</div>' +
      '<button class="btn-danger" id="confirm-del">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>' +
        'Ja, verwijderen</button>' +
      '<button class="btn-ghost" id="cancel-del">Annuleren</button>'
    : '<button class="btn-danger" id="del-btn">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>' +
        'Verwijderen</button>';

  document.getElementById('mcontent').innerHTML =
    '<h2 class="mtitle">Transactie</h2>' +
    '<div class="detail-hero">' +
      '<div class="detail-icon" style="background:' + c.color + '1a">' + c.emoji + '</div>' +
      '<div>' +
        '<div class="detail-cat">' + c.label + '</div>' +
        '<div class="detail-amt">' + eur(tx.amount) + '</div>' +
      '</div>' +
    '</div>' +
    (tx.desc ? '<div class="detail-row"><strong>' + esc(tx.desc) + '</strong></div>' : '') +
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
    document.getElementById('del-btn').addEventListener('click', function () {
      _renderDetail(tx, c, true);
    });
  }
}

function openSettings() {
  document.getElementById('mcontent').innerHTML =
    '<h2 class="mtitle">Instellingen</h2>' +
    '<div class="card" style="margin-bottom:20px;">' +
      '<div style="padding:0 16px;">' +
        '<div class="settings-row"><span>Versie</span><span>' + APP_VERSION + '</span></div>' +
        '<div class="settings-row"><span>Data opslag</span><span>Lokaal op dit apparaat</span></div>' +
      '</div>' +
    '</div>' +
    '<p class="field-lbl">Updates</p>' +
    (updateWaiting
      ? '<div class="update-feedback ok" style="margin-bottom:10px;">Update gedownload — klaar om te installeren.</div>' +
        '<button class="btn-primary" id="check-upd-btn">Herladen om te installeren</button>'
      : '<button class="btn-primary" id="check-upd-btn">Controleren op updates</button>') +
    '<div id="upd-feedback"></div>' +
    '<p class="field-lbl" style="margin-top:24px;">Data beheer</p>' +
    '<button class="btn-primary" id="export-btn">Exporteer data</button>' +
    '<button class="btn-ghost" id="import-btn" style="margin-top:10px;">Importeer data</button>' +
    '<input type="file" id="import-file" accept=".json" style="display:none">' +
    '<div id="import-preview"></div>';

  document.getElementById('check-upd-btn').addEventListener('click', async function () {
    var btn = document.getElementById('check-upd-btn');
    var fb  = document.getElementById('upd-feedback');

    if (updateWaiting) {
      applyUpdate();
      return;
    }

    btn.textContent = 'Bezig…';
    btn.disabled    = true;
    fb.innerHTML    = '';

    var result = await checkUpdate();

    if (result === 'available') {
      updateWaiting   = true;
      btn.textContent = 'Herladen om te installeren';
      btn.disabled    = false;
      fb.innerHTML    = '<div class="update-feedback ok" style="margin-top:12px;">Update gedownload! Tik nogmaals om te herladen.</div>';
    } else if (result === 'uptodate') {
      btn.textContent = 'Controleren op updates';
      btn.disabled    = false;
      fb.innerHTML    = '<div class="update-feedback ok" style="margin-top:12px;">Je hebt de nieuwste versie (' + APP_VERSION + ') ✓</div>';
    } else if (result === 'nosw') {
      btn.textContent = 'Controleren op updates';
      btn.disabled    = false;
      fb.innerHTML    = '<div class="update-feedback err" style="margin-top:12px;">Updates werken alleen via GitHub Pages, niet via een lokaal bestand.</div>';
    } else {
      btn.textContent = 'Controleren op updates';
      btn.disabled    = false;
      fb.innerHTML    = '<div class="update-feedback err" style="margin-top:12px;">Geen verbinding. Probeer het later opnieuw.</div>';
    }
  });

  document.getElementById('export-btn').addEventListener('click', async function () {
    var btn = document.getElementById('export-btn');
    btn.textContent = 'Bezig…';
    btn.disabled    = true;
    try {
      var txs  = await getAllTxs();
      var data = JSON.stringify({ version: APP_VERSION, exported: new Date().toISOString(), transactions: txs }, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = 'budget-backup-' + todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      btn.textContent = 'Exporteer data';
      btn.disabled    = false;
    } catch (err) {
      btn.textContent = 'Exporteer data';
      btn.disabled    = false;
      var fb = document.getElementById('import-preview');
      fb.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Export mislukt. Probeer opnieuw.</div>';
    }
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
        if (!parsed.transactions || !Array.isArray(parsed.transactions)) throw new Error('Ongeldig formaat');
        var txs   = parsed.transactions;
        var count = txs.length;
        var dates = txs.map(function (t) { return t.date; }).filter(Boolean).sort();
        var range = dates.length ? dates[0] + ' t/m ' + dates[dates.length - 1] : '—';
        preview.innerHTML =
          '<div style="margin-top:16px;padding:14px;background:var(--surface2);border-radius:14px;">' +
            '<div style="font-size:14px;margin-bottom:12px;">' +
              '<strong>' + count + ' transacties</strong><br>' +
              '<span style="color:var(--text2);font-size:13px;">' + range + '</span>' +
              (parsed.version ? '<br><span style="color:var(--text2);font-size:12px;">Versie: ' + esc(parsed.version) + '</span>' : '') +
            '</div>' +
            '<button class="btn-ghost" id="merge-btn" style="margin-bottom:8px;">Samenvoegen</button>' +
            '<button class="btn-danger" id="replace-btn">Vervangen</button>' +
            '<div id="import-fb"></div>' +
          '</div>';

        document.getElementById('merge-btn').addEventListener('click', async function () {
          await _doImport(txs, false);
        });
        document.getElementById('replace-btn').addEventListener('click', async function () {
          document.getElementById('import-fb').innerHTML =
            '<div style="margin-top:10px;padding:12px;background:var(--danger-t);border-radius:10px;font-size:13px;color:var(--danger);text-align:center;">Alle bestaande transacties worden gewist. Doorgaan?</div>' +
            '<button class="btn-danger" id="confirm-replace" style="margin-top:8px;">Ja, vervangen</button>' +
            '<button class="btn-ghost" id="cancel-replace" style="margin-top:8px;">Annuleren</button>';
          document.getElementById('confirm-replace').addEventListener('click', async function () {
            await _doImport(txs, true);
          });
          document.getElementById('cancel-replace').addEventListener('click', function () {
            document.getElementById('import-fb').innerHTML = '';
          });
        });
      } catch (_) {
        preview.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Ongeldig bestand. Zorg dat je een geldige Budget-export gebruikt.</div>';
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
    if (fb) fb.innerHTML = '<div class="update-feedback err" style="margin-top:12px;">Import mislukt. Probeer opnieuw.</div>';
  }
}
