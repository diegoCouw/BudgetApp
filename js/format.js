var CATS = [
  { id: 'boodschappen',  label: 'Boodschappen',  emoji: '🛒', color: '#0D9488' },
  { id: 'restaurant',    label: 'Uit eten',       emoji: '🍽️', color: '#F59E0B' },
  { id: 'transport',     label: 'Transport',      emoji: '🚗', color: '#3B82F6' },
  { id: 'wonen',         label: 'Wonen',          emoji: '🏠', color: '#8B5CF6' },
  { id: 'kleding',       label: 'Kleding',        emoji: '👕', color: '#EC4899' },
  { id: 'entertainment', label: 'Entertainment',  emoji: '🎬', color: '#F97316' },
  { id: 'gezondheid',    label: 'Gezondheid',     emoji: '💊', color: '#10B981' },
  { id: 'overig',        label: 'Overig',         emoji: '📦', color: '#94A3B8' },
];

var CMAP = (function () {
  var m = {};
  CATS.forEach(function (c) { m[c.id] = c; });
  return m;
})();

var MNL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

var _numFmt = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function eur(n) {
  return '€ ' + _numFmt.format(n);
}

function ymKey(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

function todayISO() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function fmtDay(iso) {
  var parts = iso.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2])
    .toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
