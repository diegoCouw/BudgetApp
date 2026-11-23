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
