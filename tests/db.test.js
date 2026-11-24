'use strict';

// Set up fake IndexedDB globals before requiring db.js
require('fake-indexeddb/auto');

// db.js calls ymKey() as a global — provide it from format.js
const fmt = require('../pwa/js/format.js');
global.ymKey = fmt.ymKey;

const db = require('../pwa/js/db.js');

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

test('updateTx slaat tags op', async () => {
  const id = await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  await db.updateTx(id, { amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense', tags: ['vakantie', 'extra'] });
  const txs = await db.getAllTxs();
  expect(txs[0].tags).toEqual(['vakantie', 'extra']);
});

// ── Transacties — extra gevallen ─────────────────────────────────────────────

test('addTx met type income slaat type op', async () => {
  const id = await db.addTx({ amount: 2000, cat: 'inkomst', date: '2026-11-01', ym: '2026-11', desc: 'Loon', ts: 1, type: 'income' });
  const txs = await db.getAllTxs();
  expect(txs.find(t => t.id === id).type).toBe('income');
});

test('addTx slaat tags op', async () => {
  await db.addTx({ amount: 50, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense', tags: ['sport'] });
  const txs = await db.getAllTxs();
  expect(txs[0].tags).toEqual(['sport']);
});

test('addTx geeft oplopende ids terug', async () => {
  const id1 = await db.addTx({ amount: 1, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  const id2 = await db.addTx({ amount: 2, cat: 'overig', date: '2026-11-02', ym: '2026-11', desc: '', ts: 2, type: 'expense' });
  expect(id2).toBeGreaterThan(id1);
});

test('getTxsByYM geeft lege array als maand geen transacties heeft', async () => {
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  const result = await db.getTxsByYM(2026, 9); // oktober, geen data
  expect(result).toEqual([]);
});

test('getTxsByYM met meerdere transacties in dezelfde maand', async () => {
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  await db.addTx({ amount: 20, cat: 'overig', date: '2026-11-15', ym: '2026-11', desc: '', ts: 2, type: 'expense' });
  await db.addTx({ amount: 30, cat: 'overig', date: '2026-11-30', ym: '2026-11', desc: '', ts: 3, type: 'expense' });
  const result = await db.getTxsByYM(2026, 10);
  expect(result).toHaveLength(3);
});

test('getTxsByDateRange geeft lege array als niets in bereik', async () => {
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  const result = await db.getTxsByDateRange('2026-12-01', '2026-12-31');
  expect(result).toEqual([]);
});

test('getTxsByDateRange is inclusief op grensdatums', async () => {
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  await db.addTx({ amount: 20, cat: 'overig', date: '2026-11-30', ym: '2026-11', desc: '', ts: 2, type: 'expense' });
  const result = await db.getTxsByDateRange('2026-11-01', '2026-11-30');
  expect(result).toHaveLength(2);
});

test('getTxsByDateRange met één dag bereik', async () => {
  await db.addTx({ amount: 42, cat: 'overig', date: '2026-11-15', ym: '2026-11', desc: '', ts: 1, type: 'expense' });
  await db.addTx({ amount: 10, cat: 'overig', date: '2026-11-16', ym: '2026-11', desc: '', ts: 2, type: 'expense' });
  const result = await db.getTxsByDateRange('2026-11-15', '2026-11-15');
  expect(result).toHaveLength(1);
  expect(result[0].amount).toBe(42);
});

test('bulkAddTxs behoudt type van elk record', async () => {
  await db.bulkAddTxs([
    { amount: 100, cat: 'inkomst', date: '2026-11-01', ym: '2026-11', desc: 'Loon', ts: 1, type: 'income' },
    { amount: 50,  cat: 'overig',  date: '2026-11-02', ym: '2026-11', desc: '',     ts: 2, type: 'expense' },
  ]);
  const txs = await db.getAllTxs();
  const income  = txs.find(t => t.desc === 'Loon');
  const expense = txs.find(t => t.desc === '');
  expect(income.type).toBe('income');
  expect(expense.type).toBe('expense');
});

test('bulkAddTxs valt terug op type expense als type ontbreekt', async () => {
  await db.bulkAddTxs([
    { amount: 15, cat: 'overig', date: '2026-11-01', ym: '2026-11', desc: 'test', ts: 1 },
  ]);
  const txs = await db.getAllTxs();
  expect(txs[0].type).toBe('expense');
});

// ── Generieke CRUD — extra gevallen ─────────────────────────────────────────

test('getAllRecords geeft lege array als store leeg is', async () => {
  const result = await db.getAllRecords('goals');
  expect(result).toEqual([]);
});

test('addRecord voor recurring slaat alle velden op', async () => {
  await db.addRecord('recurring', { amount: 12.99, cat: 'entertainment', desc: 'Spotify', dayOfMonth: 15, lastProcessedYM: null, type: 'expense' });
  const items = await db.getAllRecords('recurring');
  expect(items[0].amount).toBe(12.99);
  expect(items[0].dayOfMonth).toBe(15);
  expect(items[0].type).toBe('expense');
});

test('putRecord update een recurring record', async () => {
  const id = await db.addRecord('recurring', { amount: 10, cat: 'overig', desc: 'Test', dayOfMonth: 1, lastProcessedYM: null });
  await db.putRecord('recurring', { id, amount: 15, cat: 'overig', desc: 'Test', dayOfMonth: 5, lastProcessedYM: '2026-11' });
  const items = await db.getAllRecords('recurring');
  expect(items[0].amount).toBe(15);
  expect(items[0].lastProcessedYM).toBe('2026-11');
});

test('putRecord update een category record', async () => {
  const id = await db.addRecord('categories', { label: 'Sport', emoji: '⚽', color: '#22C55E' });
  await db.putRecord('categories', { id, label: 'Fitness', emoji: '🏋️', color: '#22C55E' });
  const cats = await db.getAllRecords('categories');
  expect(cats[0].label).toBe('Fitness');
});

test('delRecord verwijdert goal', async () => {
  const id = await db.addRecord('goals', { label: 'Verwijder mij', type: 'total', amount: 100, active: true });
  await db.delRecord('goals', id);
  expect(await db.getAllRecords('goals')).toHaveLength(0);
});

test('delRecord verwijdert recurring', async () => {
  const id = await db.addRecord('recurring', { amount: 5, cat: 'overig', desc: 'Del', dayOfMonth: 1, lastProcessedYM: null });
  await db.delRecord('recurring', id);
  expect(await db.getAllRecords('recurring')).toHaveLength(0);
});

test('meerdere records in goals worden allemaal opgeslagen', async () => {
  await db.addRecord('goals', { label: 'Doel 1', type: 'total',    amount: 500,  active: true });
  await db.addRecord('goals', { label: 'Doel 2', type: 'category', amount: 200,  active: true });
  await db.addRecord('goals', { label: 'Doel 3', type: 'savings',  amount: 1000, active: false });
  const goals = await db.getAllRecords('goals');
  expect(goals).toHaveLength(3);
});

test('addRecord geeft numeriek id terug', async () => {
  const id = await db.addRecord('accounts', { name: 'Test', type: 'spaar', startBalance: 100 });
  expect(typeof id).toBe('number');
  expect(id).toBeGreaterThan(0);
});
