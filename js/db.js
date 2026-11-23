var _db;

function openDB() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('budget_v1', 2);
    r.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (e.oldVersion < 1) {
        var store = db.createObjectStore('txs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('ym', 'ym', { unique: false });
      }
      if (e.oldVersion < 2) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('accounts',   { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('recurring',  { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('goals',      { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = function (e) { _db = e.target.result; res(_db); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

// ── Generic CRUD ────────────────────────────────────────────────────────────
function getAllRecords(storeName) {
  return new Promise(function (res, rej) {
    var r = _db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    r.onsuccess = function () { res(r.result); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function addRecord(storeName, data) {
  return new Promise(function (res, rej) {
    var r = _db.transaction(storeName, 'readwrite').objectStore(storeName).add(data);
    r.onsuccess = function () { res(r.result); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function putRecord(storeName, data) {
  return new Promise(function (res, rej) {
    var r = _db.transaction(storeName, 'readwrite').objectStore(storeName).put(data);
    r.onsuccess = function () { res(r.result); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

function delRecord(storeName, id) {
  return new Promise(function (res, rej) {
    var r = _db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
    r.onsuccess = function () { res(); };
    r.onerror   = function (e) { rej(e.target.error); };
  });
}

// ── Transactions ────────────────────────────────────────────────────────────
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

function getTxsByDateRange(from, to) {
  return new Promise(function (res, rej) {
    var r = _db.transaction('txs', 'readonly').objectStore('txs').getAll();
    r.onsuccess = function () {
      res(r.result.filter(function (t) { return t.date >= from && t.date <= to; }));
    };
    r.onerror = function (e) { rej(e.target.error); };
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
      var rec = {
        amount: r.amount, cat: r.cat, date: r.date, ym: r.ym,
        desc: r.desc || '', ts: r.ts || Date.now(), type: r.type || 'expense',
      };
      store.add(rec);
    });
    tx.oncomplete = function () { res(); };
    tx.onerror    = function (e) { rej(e.target.error); };
  });
}
