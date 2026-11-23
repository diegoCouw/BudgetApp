var _db;

function openDB() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('budget_v1', 1);
    r.onupgradeneeded = function (e) {
      var store = e.target.result.createObjectStore('txs', { keyPath: 'id', autoIncrement: true });
      store.createIndex('ym', 'ym', { unique: false });
    };
    r.onsuccess = function (e) { _db = e.target.result; res(_db); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function getTxsByYM(y, m) {
  var ym = ymKey(y, m);
  return new Promise(function (res, rej) {
    var r = _db.transaction('txs', 'readonly')
               .objectStore('txs').index('ym').getAll(ym);
    r.onsuccess = function () { res(r.result); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function getAllTxs() {
  return new Promise(function (res, rej) {
    var r = _db.transaction('txs', 'readonly').objectStore('txs').getAll();
    r.onsuccess = function () { res(r.result); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function addTx(data) {
  return new Promise(function (res, rej) {
    var r = _db.transaction('txs', 'readwrite').objectStore('txs').add(data);
    r.onsuccess = function () { res(r.result); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function delTx(id) {
  return new Promise(function (res, rej) {
    var r = _db.transaction('txs', 'readwrite').objectStore('txs').delete(id);
    r.onsuccess = function () { res(); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function clearAllTxs() {
  return new Promise(function (res, rej) {
    var r = _db.transaction('txs', 'readwrite').objectStore('txs').clear();
    r.onsuccess = function () { res(); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function bulkAddTxs(records) {
  return new Promise(function (res, rej) {
    if (!records.length) { res(); return; }
    var tx    = _db.transaction('txs', 'readwrite');
    var store = tx.objectStore('txs');
    records.forEach(function (r) {
      // Strip id so IndexedDB assigns a fresh one
      var rec = { amount: r.amount, cat: r.cat, date: r.date, ym: r.ym, desc: r.desc || '', ts: r.ts || Date.now() };
      store.add(rec);
    });
    tx.oncomplete = function () { res(); };
    tx.onerror    = function (e) { rej(e.target.error); };
  });
}
