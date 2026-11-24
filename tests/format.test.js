'use strict';

const {
  CATS, getCatList, catById, CAT_COLORS, MNL,
  eur, ymKey, todayISO, fmtDay, esc,
} = require('../pwa/js/format.js');

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

test('esc laat enkele aanhalingstekens ongemoeid', () => {
  expect(esc("it's")).toBe("it's");
});

test('esc verwerkt lege string', () => {
  expect(esc('')).toBe('');
});

test('esc escapet combinatie van speciale tekens', () => {
  expect(esc('<b>Hallo & "wereld"</b>')).toBe('&lt;b&gt;Hallo &amp; &quot;wereld&quot;&lt;/b&gt;');
});

// ── getCatMap ────────────────────────────────────────────────────────────────

const { getCatMap } = require('../pwa/js/format.js');

test('getCatMap geeft object terug met category ids als keys', () => {
  const map = getCatMap();
  expect(typeof map).toBe('object');
  expect(map['boodschappen']).toBeDefined();
  expect(map['overig']).toBeDefined();
});

test('getCatMap bevat alle 8 ingebouwde categorieën', () => {
  const map = getCatMap();
  expect(Object.keys(map).length).toBeGreaterThanOrEqual(8);
});

test('getCatMap waarden hebben id, label, emoji en color', () => {
  const map = getCatMap();
  Object.values(map).forEach(c => {
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('label');
    expect(c).toHaveProperty('emoji');
    expect(c).toHaveProperty('color');
  });
});

// ── catById edge cases ───────────────────────────────────────────────────────

test('catById met undefined valt terug op overig', () => {
  expect(catById(undefined).id).toBe('overig');
});

test('catById met lege string valt terug op overig', () => {
  expect(catById('').id).toBe('overig');
});

test('catById vindt alle 8 ingebouwde categorieën', () => {
  CATS.forEach(c => {
    expect(catById(c.id).id).toBe(c.id);
  });
});

// ── eur edge cases ───────────────────────────────────────────────────────────

test('eur formatteert negatief getal', () => {
  const result = eur(-15.5);
  expect(result).toContain('€');
  expect(result).toContain('15');
});

test('eur formatteert groot getal', () => {
  const result = eur(1234567.89);
  expect(result).toContain('€');
  expect(result).toContain('1');
});

test('eur heeft altijd 2 decimalen voor gehele getallen', () => {
  expect(eur(100)).toMatch(/100[.,]00/);
});

// ── ymKey edge cases ─────────────────────────────────────────────────────────

test('ymKey met maand 11 geeft december (maand 12)', () => {
  expect(ymKey(2026, 11)).toBe('2026-12');
});

test('ymKey werkt over jaargrens', () => {
  expect(ymKey(2027, 0)).toBe('2027-01');
});

test('ymKey padt enkele maandcijfers correct', () => {
  for (let m = 0; m < 9; m++) {
    expect(ymKey(2026, m)).toMatch(/2026-0\d/);
  }
});

// ── fmtDay edge cases ────────────────────────────────────────────────────────

test('fmtDay formatteert eerste dag van het jaar', () => {
  const result = fmtDay('2026-01-01');
  expect(typeof result).toBe('string');
  expect(result).toContain('1');
});

test('fmtDay formatteert laatste dag van het jaar', () => {
  const result = fmtDay('2026-12-31');
  expect(typeof result).toBe('string');
  expect(result).toContain('31');
});

test('fmtDay formatteert datum met voorloopnul correct', () => {
  const result = fmtDay('2026-03-05');
  expect(result).toContain('5');
});
