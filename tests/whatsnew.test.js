'use strict';

const { WHATS_NEW, getWhatsNew, shouldShowWhatsNew } = require('../pwa/js/format.js');

// ── WHATS_NEW data ────────────────────────────────────────────────────────────

test('WHATS_NEW heeft een entry voor 1.4.0', () => {
  expect(WHATS_NEW['1.4.0']).toBeDefined();
  expect(Array.isArray(WHATS_NEW['1.4.0'])).toBe(true);
  expect(WHATS_NEW['1.4.0'].length).toBeGreaterThan(0);
});

test('elke entry in WHATS_NEW heeft emoji en text', () => {
  Object.values(WHATS_NEW).flat().forEach(function (item) {
    expect(item).toHaveProperty('emoji');
    expect(item).toHaveProperty('text');
    expect(typeof item.emoji).toBe('string');
    expect(typeof item.text).toBe('string');
    expect(item.text.length).toBeGreaterThan(0);
  });
});

// ── getWhatsNew ───────────────────────────────────────────────────────────────

test('getWhatsNew geeft items terug voor bekende versie', () => {
  const items = getWhatsNew('1.4.0');
  expect(items).not.toBeNull();
  expect(Array.isArray(items)).toBe(true);
  expect(items.length).toBeGreaterThan(0);
});

test('getWhatsNew geeft null terug voor onbekende versie', () => {
  expect(getWhatsNew('0.0.0')).toBeNull();
  expect(getWhatsNew('999.0.0')).toBeNull();
  expect(getWhatsNew('')).toBeNull();
});

// ── shouldShowWhatsNew ────────────────────────────────────────────────────────

test('toont nieuwsscherm als er geen vorige versie is en de versie content heeft', () => {
  expect(shouldShowWhatsNew('1.4.0', null)).toBe(true);
});

test('toont geen nieuwsscherm als de versie geen content heeft, ook zonder vorige versie', () => {
  expect(shouldShowWhatsNew('0.0.0', null)).toBe(false);
});

test('toont geen nieuwsscherm als versie al gezien is', () => {
  expect(shouldShowWhatsNew('1.4.0', '1.4.0')).toBe(false);
});

test('toont nieuwsscherm bij minor version bump', () => {
  expect(shouldShowWhatsNew('1.4.0', '1.3.0')).toBe(true);
});

test('toont nieuwsscherm bij patch version bump als die content heeft', () => {
  // 1.4.0 heeft content en is groter dan 1.3.9
  expect(shouldShowWhatsNew('1.4.0', '1.3.9')).toBe(true);
});

test('toont geen nieuwsscherm als versie kleiner is dan geziene versie', () => {
  expect(shouldShowWhatsNew('1.3.0', '1.4.0')).toBe(false);
});

test('toont geen nieuwsscherm als geziene versie gelijk is maar geen content bestaat', () => {
  expect(shouldShowWhatsNew('1.3.0', '1.2.0')).toBe(false);
});

test('toont geen nieuwsscherm als seenVersion een lege string is maar versie geen content heeft', () => {
  expect(shouldShowWhatsNew('1.0.0', '')).toBe(false);
});

test('vergelijkt major versies correct — major bump triggers nieuwsscherm', () => {
  // Alleen als die versie ook content heeft; voor nu verwachten we false voor versies zonder content
  expect(shouldShowWhatsNew('2.0.0', '1.4.0')).toBe(false); // geen content voor 2.0.0
});
