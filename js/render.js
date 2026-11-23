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

  var lbl = total > 0 ? eur(total) : '€ 0,00';
  out += '<text x="' + cx + '" y="' + (cy - 7) + '" text-anchor="middle"' +
         ' font-family="Space Grotesk,sans-serif" font-weight="700" font-size="18" fill="var(--fg)">' + esc(lbl) + '</text>';
  out += '<text x="' + cx + '" y="' + (cy + 13) + '" text-anchor="middle"' +
         ' font-family="Inter,sans-serif" font-size="12" fill="var(--muted)">deze maand</text>';
  return out + '</svg>';
}

function txHTML(tx) {
  var isIncome   = tx.type === 'income';
  var isTransfer = tx.type === 'transfer';
  var c;

  if (isIncome) {
    c = { emoji: '💰', label: 'Inkomst', color: '#22C55E' };
  } else if (isTransfer) {
    c = { emoji: '⇄', label: tx.desc || 'Overschrijving', color: '#6366F1' };
  } else {
    c = catById(tx.cat);
  }

  var amtClass = isIncome ? ' income' : (isTransfer ? ' transfer-amt' : '');
  var amtPrefix = isIncome ? '+' : (isTransfer ? '' : '');

  return '<div class="tx" data-id="' + tx.id + '" role="button" tabindex="0">' +
    '<div class="tx-icon" style="background:' + c.color + '1a">' + c.emoji + '</div>' +
    '<div class="tx-info">' +
      '<div class="tx-desc">' + esc(tx.desc || c.label) + '</div>' +
      '<div class="tx-cat">' + c.label + '</div>' +
    '</div>' +
    '<div class="tx-amt' + amtClass + '">' + amtPrefix + eur(tx.amount) + '</div>' +
  '</div>';
}

function bindTxClicks(el, txs) {
  el.querySelectorAll('.tx').forEach(function (item) {
    var id = Number(item.dataset.id);
    item.addEventListener('click', function () { openDetail(id, txs); });
    item.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDetail(id, txs); });
  });
}

async function renderGoalsSection(txs) {
  var goalsEl = document.getElementById('h-goals');
  if (!goalsEl) return;

  var goals = await getAllRecords('goals');
  var active = goals.filter(function (g) { return g.active; });

  if (!active.length) {
    goalsEl.innerHTML = '';
    return;
  }

  var today    = todayISO();
  var catMap   = getCatMap();
  var expenses = txs.filter(function (t) { return (t.type || 'expense') === 'expense'; });
  var incomeAmt = txs.filter(function (t) { return t.type === 'income'; })
                     .reduce(function (s, t) { return s + t.amount; }, 0);
  var expTotal  = expenses.reduce(function (s, t) { return s + t.amount; }, 0);

  var cards = await Promise.all(active.map(async function (goal) {
    var spent = 0, target = goal.amount, label = goal.label;
    var subInfo = null, isSavings = goal.type === 'savings';

    if (goal.type === 'category') {
      spent = expenses.filter(function (t) { return t.cat === goal.catId; })
                      .reduce(function (s, t) { return s + t.amount; }, 0);
    } else if (goal.type === 'total') {
      spent = expTotal;
    } else if (goal.type === 'savings') {
      if (incomeAmt === 0) {
        return '<div class="goal-card">' +
          '<div class="goal-label">💰 ' + esc(label) + '</div>' +
          '<div style="color:var(--muted);font-size:13px;margin-top:6px;">Voeg inkomsten toe om de spaardoelstelling te berekenen.</div>' +
        '</div>';
      }
      spent = incomeAmt - expTotal;
    } else if (goal.type === 'period' && goal.dateFrom && goal.dateTo) {
      var rangeEnd = today > goal.dateTo ? goal.dateTo : today;
      var rangeTxs = await getTxsByDateRange(goal.dateFrom, rangeEnd);
      spent = rangeTxs.filter(function (t) { return (t.type || 'expense') === 'expense'; })
                      .reduce(function (s, t) { return s + t.amount; }, 0);
      subInfo = goal.dateFrom + ' t/m ' + goal.dateTo;
    }

    var pct, fillClass;
    if (isSavings) {
      if (spent < 0) { pct = 0; fillClass = 'over'; }
      else { pct = target > 0 ? Math.min(spent / target * 100, 100) : 100; fillClass = pct >= 70 ? 'ok' : (pct >= 40 ? 'warn' : 'over'); }
    } else {
      pct = target > 0 ? Math.min(spent / target * 100, 100) : 0;
      fillClass = pct > 100 ? 'over' : (pct >= 70 ? 'warn' : 'ok');
    }

    var pctColor = fillClass === 'ok' ? '#22C55E' : (fillClass === 'warn' ? '#F59E0B' : 'var(--danger)');

    return '<div class="goal-card">' +
      '<div class="goal-header">' +
        '<div>' +
          '<div class="goal-label">' + esc(label) + '</div>' +
          (subInfo ? '<div style="font-size:12px;color:var(--muted);margin-top:2px;">' + esc(subInfo) + '</div>' : '') +
          '<div class="goal-amounts">' + (isSavings ? 'Gespaard: ' : '') + eur(Math.max(spent, 0)) + ' / ' + eur(target) + '</div>' +
        '</div>' +
        '<span style="font-weight:700;font-size:14px;color:' + pctColor + '">' + Math.round(pct) + '%</span>' +
      '</div>' +
      '<div class="goal-track"><div class="goal-fill ' + fillClass + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
    '</div>';
  }));

  goalsEl.innerHTML = '<p class="section-label">Doelstellingen</p>' + cards.join('');
}

async function renderHome() {
  document.getElementById('h-mlabel').textContent = MNL[curM] + ' ' + curY;

  var txs      = await getTxsByYM(curY, curM);
  var expenses = txs.filter(function (t) { return (t.type || 'expense') === 'expense'; });
  var income   = txs.filter(function (t) { return t.type === 'income'; });
  var totalExp = expenses.reduce(function (s, t) { return s + t.amount; }, 0);
  var totalInc = income.reduce(function (s, t) { return s + t.amount; }, 0);

  var catExpMap = {};
  expenses.forEach(function (t) { catExpMap[t.cat] = (catExpMap[t.cat] || 0) + t.amount; });

  var segs = getCatList()
    .filter(function (c) { return catExpMap[c.id]; })
    .map(function (c) { return Object.assign({}, c, { amount: catExpMap[c.id] }); })
    .sort(function (a, b) { return b.amount - a.amount; });

  var donutContent = '';
  if (totalInc > 0) {
    var net = totalInc - totalExp;
    var netCol = net >= 0 ? '#22C55E' : 'var(--danger)';
    donutContent += '<div style="display:flex;justify-content:space-around;padding:0 4px 4px;margin-bottom:4px;">' +
      '<div style="text-align:center;">' +
        '<div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Inkomsten</div>' +
        '<div style="font-family:Space Grotesk,sans-serif;font-weight:700;font-size:15px;color:#22C55E;">' + eur(totalInc) + '</div>' +
      '</div>' +
      '<div style="text-align:center;">' +
        '<div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Netto</div>' +
        '<div style="font-family:Space Grotesk,sans-serif;font-weight:700;font-size:15px;color:' + netCol + ';">' + (net >= 0 ? '+' : '') + eur(net) + '</div>' +
      '</div>' +
    '</div>';
  }

  donutContent += donutSVG(segs, totalExp);

  if (segs.length) {
    var legendHTML = segs.map(function (s) {
      return '<div class="leg-item">' +
        '<div class="leg-dot" style="background:' + s.color + '"></div>' +
        '<span class="leg-name">' + s.label + '</span>' +
        '<span class="leg-amt">' + eur(s.amount) + '</span>' +
      '</div>';
    }).join('');
    donutContent += '<div class="cat-legend">' + legendHTML + '</div>';
  }
  document.getElementById('h-donut').innerHTML = donutContent;

  // Goals section
  await renderGoalsSection(txs);

  // Recent transactions (all types shown)
  var recentEl = document.getElementById('h-recent');
  var sorted = txs.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date) || b.id - a.id;
  }).slice(0, 5);

  if (!sorted.length) {
    recentEl.innerHTML = '<div class="empty"><div class="empty-icon">💰</div>' +
      '<h3>Nog geen transacties</h3><p>Tik op + om je eerste transactie te registreren.</p></div>';
  } else {
    recentEl.innerHTML = '<div class="card">' + sorted.map(txHTML).join('') + '</div>';
    bindTxClicks(recentEl, txs);
  }
}

async function renderTransacties() {
  document.getElementById('t-mlabel').textContent = MNL[curM] + ' ' + curY;

  var txs;
  var usingFilter = curDateFrom && curDateTo;

  if (usingFilter) {
    txs = await getTxsByDateRange(curDateFrom, curDateTo);
    document.getElementById('t-mlabel').textContent = curDateFrom + ' t/m ' + curDateTo;
  } else {
    txs = await getTxsByYM(curY, curM);
  }

  var listEl = document.getElementById('t-list');

  if (!txs.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div>' +
      '<h3>Geen transacties</h3><p>Tik op + om een transactie toe te voegen.</p></div>';
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
    var dayTotal = items
      .filter(function (t) { return (t.type || 'expense') === 'expense'; })
      .reduce(function (s, t) { return s + t.amount; }, 0);
    return '<div class="day-group">' +
      '<div class="day-header"><span>' + fmtDay(date) + '</span>' +
      '<span class="day-total">' + (dayTotal > 0 ? eur(dayTotal) : '') + '</span></div>' +
      '<div class="card">' + items.map(txHTML).join('') + '</div>' +
    '</div>';
  }).join('');

  bindTxClicks(listEl, txs);
}

async function renderStats() {
  var all      = await getAllTxs();
  var allExp   = all.filter(function (t) { return (t.type || 'expense') === 'expense'; });
  var allCats  = getCatList();

  // Last 6 months (expenses only)
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d   = new Date(curY, curM - i, 1);
    var ym  = ymKey(d.getFullYear(), d.getMonth());
    var tot = allExp.filter(function (t) { return t.ym === ym; })
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

  // Current month by category (expenses only)
  var curYM  = ymKey(curY, curM);
  var mTxs   = allExp.filter(function (t) { return t.ym === curYM; });
  var catM   = {};
  mTxs.forEach(function (t) { catM[t.cat] = (catM[t.cat] || 0) + t.amount; });

  var catList = allCats
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
