# PWA — architectuur en componenten

## Overzicht

De PWA (Progressive Web App) is de primaire gebruikersinterface, gebouwd in **vanilla JavaScript**. Ze draait volledig in de browser, werkt offline, en kan als app worden geïnstalleerd op de iPhone via Safari.

**TypeScript-migratie is gepland** — nieuwe bestanden moeten in TypeScript worden geschreven.

---

## Locatie en hosting

| Omgeving | URL |
|---|---|
| Productie (`main`) | `https://diegocouw.github.io/BudgetApp/` |
| Preview (`develop`) | `https://diegocouw.github.io/BudgetApp/dev/` |

---

## Bestandsstructuur

```
pwa/
├── index.html          # Enige HTML-pagina (SPA)
├── manifest.json       # PWA manifest (naam, iconen, standalone mode)
├── sw.js               # Service Worker — caching + offline
├── css/
│   └── app.css         # Alle stijlen
├── js/
│   ├── version.js      # APP_VERSION (bijv. '1.3.0') — handmatig bijwerken
│   ├── format.js       # Helpers en globale state
│   ├── db.js           # IndexedDB wrapper
│   ├── render.js       # View-renderers (home, transacties, statistieken)
│   ├── modal.js        # Modal + swipe-to-dismiss
│   ├── bank.js         # Bank tab (login, koppelen, sync, categoriseren)
│   └── app.js          # Boot, navigatie, service worker
└── icons/
    └── icon.svg
```

**Laadvolgorde scripts** (volgorde in index.html):
```
version.js → format.js → db.js → render.js → modal.js → bank.js → app.js
```

---

## Views (tabs)

| View ID | Tab | Beschrijving |
|---|---|---|
| `home` | Huis-icoon | Dashboard: saldo, inkomsten/uitgaven, recente transacties |
| `transacties` | Lijst-icoon | Alle transacties, filter op datum, categorie |
| `statistieken` | Grafiek-icoon | Statistieken per categorie, maandvergelijking |
| `bank` | Slotje-icoon | Bank tab: login, koppelen, sync, categoriseren |

Actieve view in `var activeV` (globaal in `app.js`).

---

## Globale state (app.js)

```js
var curY          // Huidig geselecteerd jaar (Number)
var curM          // Huidig geselecteerde maand, 0-gebaseerd (Number)
var activeV       // Actieve view: 'home' | 'transacties' | 'statistieken' | 'bank'
var swReg         // ServiceWorkerRegistration object
var updateWaiting // true als er een wachtende SW-update is
var curDateFrom   // Datumfilter transacties: van (string yyyy-MM-dd of null)
var curDateTo     // Datumfilter transacties: tot (string yyyy-MM-dd of null)
var _accounts     // Lijst van rekeningen (geladen bij boot)
```

---

## IndexedDB (db.js)

Database: `budget_v1` (versie 2), 5 object stores:

| Store | Sleutel | Wat staat erin |
|---|---|---|
| `txs` | id (auto) | Cash/manuele transacties (inkomsten en uitgaven) |
| `categories` | id (auto) | Eigen categorieën (label, emoji, kleur) |
| `accounts` | id (auto) | Rekeningen (naam, type, startbedrag) |
| `recurring` | id (auto) | Vaste lasten / domicilieringen |
| `goals` | id (auto) | Spaar- en budgetdoelen |

Bankgegevens (gesyncte transacties) staan **niet** in IndexedDB — die komen van de backend via de bank tab.

---

## format.js — helpers

| Functie/variabele | Beschrijving |
|---|---|
| `eur(amount)` | Formatteer als valuta (bijv. `€ 42,50`) |
| `ymKey(year, month)` | Maak een jaar-maand sleutel (bijv. `'2026-11'`) |
| `fmtDay(dateStr)` | Formatteer datum als leesbare string |
| `esc(str)` | HTML-escape voor veilige rendering |
| `todayISO()` | Huidige datum als `yyyy-MM-dd` |
| `_userCats` | Globale array van eigen categorieën (geladen bij boot) |
| `CATS` | Vaste categorieën (array van `{id, label, emoji, color}`) |

---

## Service Worker (sw.js)

Cache-naam bevat de versie: `budget-1.3.0`. Bij een versie-bump verdwijnt de oude cache automatisch.

**Update-flow:**
1. Instellingen → "Controleren op updates" → `swReg.update()`
2. Nieuwe versie gevonden → `updateWaiting = true`
3. Tweede tik → `skipWaiting` → pagina herlaadt

**Bij nieuwe bestanden altijd toevoegen aan `ASSETS` in `sw.js`.**

---

## Bank tab (bank.js)

Zie [08-applicatie-werking.md](08-applicatie-werking.md) voor de end-to-end flow.

| Functie | Beschrijving |
|---|---|
| `getToken()` / `setToken()` / `clearToken()` | JWT in `localStorage['prospero_jwt']` |
| `apiCall(method, path, body)` | Authenticated fetch, 401 → clearToken() + redirect naar login |
| `renderBank()` | Entry point: check token → login of main |
| `renderBankLogin()` | Login form met wachtwoord-toggle |
| `doLogin()` | POST /auth/login, JWT opslaan |
| `renderBankMain()` | Hoofdscherm: koppelen, sync, verbreken, uitloggen |
| `doConnect()` | POST /bank/connect → redirect naar bank |
| `doSync()` | GET /bank/sync (30 dagen bereik) |
| `doDisconnect()` | DELETE /bank/session (inline bevestiging: tik 2x) |
| `loadBankTxs()` | GET /transactions → filter + lijst |
| `renderBankCatFilter()` | Horizontale filter-chips per gebruikte categorie |
| `renderBankTxList(search)` | Transactielijst met gekleurde badges, paginering |
| `openCategoryPicker(txId, labelEl)` | Modal met emoji-chips, eigen invoer, wissen |
| `setCategory(txId, cat, labelEl)` | PATCH /transactions/{id}/category |

---

## Versienummering

| Bestand | Wat bijwerken |
|---|---|
| `pwa/js/version.js` | `var APP_VERSION = '1.3.0';` |
| `pwa/sw.js` | `const CACHE = 'budget-1.3.0';` |

**Beide bestanden altijd tegelijk bijwerken bij een release.**

| Increment | Wanneer |
|---|---|
| `major` | Grote herwerking (bijv. migratie naar Angular) |
| `minor` | Nieuwe feature |
| `patch` | Bugfix |

---

## CSS-architectuur

Eén bestand: `pwa/css/app.css`. CSS-variabelen voor theming:

```css
:root {
  --bg: #ffffff;
  --fg: #111827;
  --accent: #2563eb;
  --muted: #6b7280;
  --border: #e5e7eb;
  --danger: #dc2626;
  /* ... */
}
```

Dark mode via `@media (prefers-color-scheme: dark)` en `[data-theme="dark"]`.

---

## Thema

Thema-voorkeur opgeslagen in `localStorage['budget_theme']` (`'light'` of `'dark'`).  
Toggle via de zon/maan-knop in de header.

---

## Tests

76 unit tests in `tests/` (Jest + fake-indexeddb):

```powershell
cd BudgetApp  # root van de repo
npm test
npm run coverage
```

Coverage: `pwa/js/format.js` en `pwa/js/db.js`.
