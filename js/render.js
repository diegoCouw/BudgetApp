function donutSVG(segs, total) {
  var r = 68, cx = 90, cy = 90, sw = 20, C = 2 * Math.PI * r, sz = 180;
  var out = '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 ' + sz + ' ' + sz + '" style="overflow:visible">';
  out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="' + sw + '"/>';

  if (total > 0) {
    var offset = 0;
    segs.forEach(function (s) {
      var dash = (s.amount / total) * C;
      var gap  = C - dash;
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"' +
             ' stroke="' + s.color + '" stroke-width="' + sw + '"' +
             ' stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) + '"' +
             ' stroke-dashoffset="' + (-offset).toFixed(2) + '"' +
             ' transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      offset += dash;
    });
  }

  var lbl = total > 0 ? eur(total) : '€ 0,00';
  out += '<text x="' + cx + '" y="' + (cy - 7) + '" text-anchor="middle"' +
         ' font-family="Space Grotesk,sans-serif" font-weight="700" font-size="18" fill="var(--fg)">' + esc(lbl) + '</text>';
  out += '<text x="' + cx + '" y="' + (cy + 13) + '" text-anchor="middle"' +
         ' font-family="Inter,sans-serif" font-size="12" fill="var(--muted)">deze maand</text>';
  return out + '</svg>';
}

function txHTML(tx) {
  var c = CMAP[tx.cat] || CMAP['overig'];
  return '<div class="tx" data-id="' + tx.id + '" role="button" tabindex="0">' +
    '<div class="tx-icon" style="background:' + c.color + '1a">' + c.emoji + '</div>' +
    '<div class="tx-info">' +
      '<div class="tx-desc">' + esc(tx.desc || c.label) + '</div>' +
      '<div class="tx-cat">' + c.label + '</div>' +
    '</div>' +
    '<div class="tx-amt">' + eur(tx.amount) + '</div>' +
  '</div>';
}

function bindTxClicks(el, txs) {
  el.querySelectorAll('.tx').forEach(function (item) {
    var id = Number(item.dataset.id);
    item.addEventListener('click', function () { openDetail(id, txs); });
    item.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDetail(id, txs); });
  });
}

async function renderHome() {
  document.getElementById('h-mlabel').textContent = MNL[curM] + ' ' + curY;

  var txs   = await getTxsByYM(curY, curM);
  var total = txs.reduce(function (s, t) { return s + t.amount; }, 0);

  var catMap = {};
  txs.forEach(function (t) { catMap[t.cat] = (catMap[t.cat] || 0) + t.amount; });

  var segs = CATS
    .filter(function (c) { return catMap[c.id]; })
    .map(function (c) { return Object.assign({}, c, { amount: catMap[c.id] }); })
    .sort(function (a, b) { return b.amount - a.amount; });

  var legendHTML = segs.map(function (s) {
    return '<div class="leg-item">' +
      '<div class="leg-dot" style="background:' + s.color + '"></div>' +
      '<span class="leg-name">' + s.label + '</span>' +
      '<span class="leg-amt">' + eur(s.amount) + '</span>' +
    '</div>';
  }).join('');

  document.getElementById('h-donut').innerHTML =
    donutSVG(segs, total) + (segs.length ? '<div class="cat-legend">' + legendHTML + '</div>' : '');

  var recentEl = document.getElementById('h-recent');
  var sorted = txs.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date) || b.id - a.id;
  }).slice(0, 5);

  if (!sorted.length) {
    recentEl.innerHTML = '<div class="empty"><div class="empty-icon">💰</div>' +
      '<h3>Nog geen transacties</h3><p>Tik op + om je eerste uitgave te registreren.</p></div>';
  } else {
    recentEl.innerHTML = '<div class="card">' + sorted.map(txHTML).join('') + '</div>';
    bindTxClicks(recentEl, txs);
  }
}

async function renderTransacties() {
  document.getElementById('t-mlabel').textContent = MNL[curM] + ' ' + curY;

  var txs    = await getTxsByYM(curY, curM);
  var listEl = document.getElementById('t-list');

  if (!txs.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div>' +
      '<h3>Geen transacties</h3><p>Tik op + om een uitgave toe te voegen.</p></div>';
    return;
  }

  var groups = {};
  txs.forEach(function (t) {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  var days = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });

  listEl.innerHTML = days.map(function (date) {
    var items    = groups[date].sort(function (a, b) { return b.id - a.id; });
    var dayTotal = items.reduce(function (s, t) { return s + t.amount; }, 0);
    return '<div class="day-group">' +
      '<div class="day-header"><span>' + fmtDay(date) + '</span>' +
      '<span class="day-total">' + eur(dayTotal) + '</span></div>' +
      '<div class="card">' + items.map(txHTML).join('') + '</div>' +
    '</div>';
  }).join('');

  bindTxClicks(listEl, txs);
}

async function renderStats() {
  var all = await getAllTxs();

  // Last 6 months bar chart
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d  = new Date(curY, curM - i, 1);
    var ym = ymKey(d.getFullYear(), d.getMonth());
    var tot = all.filter(function (t) { return t.ym === ym; })
                 .reduce(function (s, t) { return s + t.amount; }, 0);
    months.push({ label: MNL[d.getMonth()].slice(0, 3), tot: tot });
  }

  var maxM = Math.max.apply(null, months.map(function (m) { return m.tot; }).concat([0.01]));
  document.getElementById('s-monthly').innerHTML = months.map(function (m) {
    return '<div class="bar-row">' +
      '<div class="bar-label">' + m.label + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + (m.tot / maxM * 100).toFixed(1) + '%;background:var(--accent)"></div></div>' +
      '<div class="bar-val">' + eur(m.tot) + '</div>' +
    '</div>';
  }).join('');

  // Current month by category
  var curYM   = ymKey(curY, curM);
  var mTxs    = all.filter(function (t) { return t.ym === curYM; });
  var catM    = {};
  mTxs.forEach(function (t) { catM[t.cat] = (catM[t.cat] || 0) + t.amount; });

  var catList = CATS
    .filter(function (c) { return catM[c.id]; })
    .map(function (c) { return Object.assign({}, c, { tot: catM[c.id] }); })
    .sort(function (a, b) { return b.tot - a.tot; });

  var maxC = Math.max.apply(null, catList.map(function (c) { return c.tot; }).concat([0.01]));

  document.getElementById('s-cats').innerHTML = catList.length
    ? catList.map(function (c) {
        return '<div class="bar-row">' +
          '<div class="bar-label"><span>' + c.emoji + '</span>' + c.label + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + (c.tot / maxC * 100).toFixed(1) + '%;background:' + c.color + '"></div></div>' +
          '<div class="bar-val">' + eur(c.tot) + '</div>' +
        '</div>';
      }).join('')
    : '<div style="padding:16px;text-align:center;color:var(--muted);font-size:14px;">Geen data voor deze maand</div>';
}
