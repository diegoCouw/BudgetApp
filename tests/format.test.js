'use strict';

const {
  CATS, getCatList, catById, CAT_COLORS, MNL,
  eur, ymKey, todayISO, fmtDay, esc,
} = require('../js/format.js');

// ── CATS & categories ────────────────────────────────────────────────────────

test('CATS bevat 8 ingebouwde categorieën', () => {
  expect(CATS).toHaveLength(8);
});

test('elke categorie heeft id, label, emoji en color', () => {
  CATS.forEach(c => {
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('label');
    expect(c).toHaveProperty('emoji');
    expect(c).toHaveProperty('color');
  });
});

test('getCatList geeft minstens de ingebouwde categorieën terug', () => {
  expect(getCatList().length).toBeGreaterThanOrEqual(CATS.length);
});

test('catById vindt een bestaande categorie', () => {
  const c = catById('boodschappen');
  expect(c.id).toBe('boodschappen');
});

test('catById valt terug op overig voor onbekende id', () => {
  const c = catById('bestaat-niet');
  expect(c.id).toBe('overig');
});

test('CAT_COLORS bevat 12 kleuren', () => {
  expect(CAT_COLORS).toHaveLength(12);
  CAT_COLORS.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
});

test('MNL heeft 12 maandnamen', () => {
  expect(MNL).toHaveLength(12);
  expect(MNL[0]).toBe('Januari');
  expect(MNL[11]).toBe('December');
});

// ── eur ─────────────────────────────────────────────────────────────────────

test('eur formatteert geheel getal', () => {
  const result = eur(10);
  expect(result).toContain('€');
  expect(result).toContain('10');
});

test('eur formatteert altijd 2 decimalen', () => {
  expect(eur(12.5)).toMatch(/12[.,]50/);
});

test('eur formatteert nul correct', () => {
  expect(eur(0)).toContain('0');
});

// ── ymKey ────────────────────────────────────────────────────────────────────

test('ymKey met maand 0 geeft 2026-01', () => {
  expect(ymKey(2026, 0)).toBe('2026-01');
});

test('ymKey met maand 10 geeft 2026-11', () => {
  expect(ymKey(2026, 10)).toBe('2026-11');
});

test('ymKey padt maand met voorloopnul', () => {
  expect(ymKey(2026, 2)).toBe('2026-03');
});

// ── todayISO ─────────────────────────────────────────────────────────────────

test('todayISO geeft YYYY-MM-DD formaat', () => {
  expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('todayISO jaar klopt', () => {
  const year = new Date().getFullYear().toString();
  expect(todayISO()).toContain(year);
});

// ── fmtDay ───────────────────────────────────────────────────────────────────

test('fmtDay geeft een niet-lege string', () => {
  const result = fmtDay('2026-11-23');
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
});

test('fmtDay bevat het dagnummer', () => {
  expect(fmtDay('2026-11-05')).toContain('5');
});

// ── esc ──────────────────────────────────────────────────────────────────────

test('esc escapet <script>', () => {
  expect(esc('<script>')).toBe('&lt;script&gt;');
});

test('esc escapet &', () => {
  expect(esc('a & b')).toBe('a &amp; b');
});

test('esc escapet aanhalingstekens', () => {
  expect(esc('"hallo"')).toBe('&quot;hallo&quot;');
});

test('esc laat veilige tekst ongemoeid', () => {
  expect(esc('Albert Heijn')).toBe('Albert Heijn');
});

test('esc converteert getal naar string', () => {
  expect(esc(42)).toBe('42');
});

// BEWUSTE FOUT — merge blokkeer test
test('blokkeer de merge', () => {
  expect('rood').toBe('groen');
});
