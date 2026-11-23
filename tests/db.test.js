'use strict';

// Set up fake IndexedDB globals before requiring db.js
require('fake-indexeddb/auto');

// db.js calls ymKey() as a global — provide it from format.js
const fmt = require('../js/format.js');
global.ymKey = fmt.ymKey;

const db = require('../js/db.js');

beforeAll(async () => {
  await db.openDB();
});

afterEach(async () => {
  await db.clearAllTxs();
  // Clear goals, accounts, recurring, categories after each test
  const stores = ['goals', 'accounts', 'recurring', 'categories'];
  for (const s of stores) {
    const records = await db.getAllRecords(s);
    for (const r of records) {
      await db.delRecord(s, r.id);
    }
  }
});

// ── Transactions ─────────────────────────────────────────────────────────────

test('addTx geeft een numerieke id terug', async () => {
  const id = await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  expect(typeof id).toBe('number');
  expect(id).toBeGreaterThan(0);
});

test('getAllTxs geeft lege array als er niets is', async () => {
  const txs = await db.getAllTxs();
  expect(txs).toEqual([]);
});

test('getAllTxs geeft toegevoegde transacties terug', async () => {
  await db.addTx({ amount: 25, cat: 'boodschappen', date: '2026-11-10', ym: '2026-11', desc: 'AH', ts: Date.now(), type: 'expense' });
  await db.addTx({ amount: 50, cat: 'transport',    date: '2026-11-15', ym: '2026-11', desc: 'NS', ts: Date.now(), type: 'expense' });
  const txs = await db.getAllTxs();
  expect(txs).toHaveLength(2);
});

test('getTxsByYM filtert op jaar en maand', async () => {
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  await db.addTx({ amount: 20, cat: 'overig', date: '2026-10-15', ym: '2026-10', desc: '', ts: Date.now(), type: 'expense' });

  const nov = await db.getTxsByYM(2026, 10); // 0-indexed → november
  expect(nov).toHaveLength(1);
  expect(nov[0].amount).toBe(10);

  const okt = await db.getTxsByYM(2026, 9);
  expect(okt).toHaveLength(1);
  expect(okt[0].amount).toBe(20);
});

test('delTx verwijdert de juiste transactie', async () => {
  const id = await db.addTx({ amount: 99, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  await db.delTx(id);
  const txs = await db.getAllTxs();
  expect(txs).toHaveLength(0);
});

test('clearAllTxs wist alle transacties', async () => {
  await db.addTx({ amount: 1, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  await db.addTx({ amount: 2, cat: 'overig', date: '2026-11-02', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  await db.clearAllTxs();
  expect(await db.getAllTxs()).toHaveLength(0);
});

test('bulkAddTxs voegt meerdere records toe', async () => {
  const records = [
    { amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' },
    { amount: 20, cat: 'overig', date: '2026-11-02', ym: '2026-11', desc: '', ts: 2, type: 'expense' },
    { amount: 30, cat: 'overig', date: '2026-11-03', ym: '2026-11', desc: '', ts: 3, type: 'expense' },
  ];
  await db.bulkAddTxs(records);
  expect(await db.getAllTxs()).toHaveLength(3);
});

test('bulkAddTxs met lege array gooit geen fout', async () => {
  await expect(db.bulkAddTxs([])).resolves.toBeUndefined();
});

test('getTxsByDateRange filtert op datumbereik', async () => {
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-05', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  await db.addTx({ amount: 20, cat: 'overig', date: '2026-11-15', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });
  await db.addTx({ amount: 30, cat: 'overig', date: '2026-11-25', ym: '2026-11', desc: '', ts: Date.now(), type: 'expense' });

  const result = await db.getTxsByDateRange('2026-11-10', '2026-11-20');
  expect(result).toHaveLength(1);
  expect(result[0].amount).toBe(20);
});

// ── Generieke CRUD (goals / accounts / recurring / categories) ───────────────

test('addRecord en getAllRecords voor goals', async () => {
  await db.addRecord('goals', { label: 'Test doel', type: 'total', amount: 1000, active: true });
  const goals = await db.getAllRecords('goals');
  expect(goals).toHaveLength(1);
  expect(goals[0].label).toBe('Test doel');
});

test('putRecord update een bestaand record', async () => {
  const id = await db.addRecord('goals', { label: 'Oud', type: 'total', amount: 500, active: true });
  await db.putRecord('goals', { id, label: 'Nieuw', type: 'total', amount: 800, active: true });
  const goals = await db.getAllRecords('goals');
  expect(goals[0].label).toBe('Nieuw');
  expect(goals[0].amount).toBe(800);
});

test('delRecord verwijdert het record', async () => {
  const id = await db.addRecord('accounts', { name: 'Spaar', type: 'spaar', startBalance: 500 });
  await db.delRecord('accounts', id);
  const accounts = await db.getAllRecords('accounts');
  expect(accounts).toHaveLength(0);
});

test('addRecord voor accounts slaat type op', async () => {
  await db.addRecord('accounts', { name: 'Vakantie', type: 'spaar', startBalance: 0 });
  const accounts = await db.getAllRecords('accounts');
  expect(accounts[0].type).toBe('spaar');
  expect(accounts[0].name).toBe('Vakantie');
});

test('addRecord voor recurring slaat domiciliering op', async () => {
  await db.addRecord('recurring', { amount: 45, cat: 'wonen', desc: 'Netflix', dayOfMonth: 1, lastProcessedYM: null });
  const items = await db.getAllRecords('recurring');
  expect(items).toHaveLength(1);
  expect(items[0].desc).toBe('Netflix');
  expect(items[0].dayOfMonth).toBe(1);
});

test('addRecord voor categories slaat eigen categorie op', async () => {
  await db.addRecord('categories', { label: 'Huisdieren', emoji: '🐾', color: '#EF4444' });
  const cats = await db.getAllRecords('categories');
  expect(cats[0].label).toBe('Huisdieren');
});

test('updateTx past bestaande transactie aan', async () => {
  const id = await db.addTx({ amount: 50, cat: 'boodschappen', date: '2026-11-01', ym: '2026-11', desc: 'AH', ts: Date.now(), type: 'expense' });
  await db.updateTx(id, { amount: 75, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: 'Lidl', ts: Date.now(), type: 'expense' });
  const txs = await db.getAllTxs();
  expect(txs).toHaveLength(1);
  expect(txs[0].amount).toBe(75);
  expect(txs[0].desc).toBe('Lidl');
  expect(txs[0].id).toBe(id);
});

test('updateTx behoudt het originele id', async () => {
  const id = await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-02', ym: '2026-11', desc: 'test', ts: 1000, type: 'expense' });
  await db.updateTx(id, { amount: 20, cat: 'overig', date: '2026-11-02', ym: '2026-11', desc: 'test2', ts: 1000, type: 'expense' });
  const txs = await db.getAllTxs();
  expect(txs[0].id).toBe(id);
  expect(txs[0].amount).toBe(20);
});
