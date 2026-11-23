# BudgetApp

Een persoonlijke budgeteringsapp als PWA (Progressive Web App) voor iPhone. Geen server, geen account — alle data wordt lokaal op het apparaat opgeslagen via IndexedDB.

**Live:** [https://diegocouw.github.io/BudgetApp/](https://diegocouw.github.io/BudgetApp/)

---

## Functies

- Transacties bijhouden per maand en categorie
- Visuele statistieken met donut-chart en staafdiagrammen
- Installeerbaar op iPhone via Safari → "Voeg toe aan beginscherm"
- Werkt volledig offline via service worker
- Automatische versie-nummering (`jaar.maand.dag`) bij elke push
- In-app updates via Instellingen → "Controleren op updates"
- Export en import van data als JSON-bestandje (backup)

---

## Installeren op iPhone

1. Open [https://diegocouw.github.io/BudgetApp/](https://diegocouw.github.io/BudgetApp/) in **Safari**
2. Tik op het deel-icoon (vierkantje met pijltje)
3. Kies **"Voeg toe aan beginscherm"**
4. De app opent voortaan als standalone app, zonder adresbalk

---

## Projectstructuur

```
BudgetApp/
├── index.html          # Hoofd-HTML: views, header, bottom nav, modal overlay
├── manifest.json       # PWA-manifest (naam, icoon, kleur)
├── sw.js               # Service worker: offline caching, update-mechanisme
├── css/
│   └── app.css         # Alle stijlen: tokens, layout, components, donker thema
├── js/
│   ├── version.js      # APP_VERSION — automatisch bijgewerkt door GitHub Actions
│   ├── format.js       # Categorieën, helper-functies (eur, ymKey, fmtDay, esc)
│   ├── db.js           # IndexedDB-wrapper (openDB, addTx, delTx, getAllTxs, ...)
│   ├── render.js       # View-renderers (renderHome, renderTransacties, renderStats)
│   ├── modal.js        # Modal-logica (openAdd, openDetail, openSettings)
│   └── app.js          # Boot, global state, service worker registratie
├── icons/
│   └── icon.svg        # App-icoon (512×512, teal achtergrond met €-teken)
└── .github/
    └── workflows/
        └── version.yml # GitHub Actions: versie bijwerken bij elke push naar main
```

---

## Architectuur

### Global state (app.js)

```js
var curY          // Huidig geselecteerd jaar (Number)
var curM          // Huidig geselecteerde maand, 0-gebaseerd (Number)
var activeV       // Actieve view: 'home' | 'transacties' | 'statistieken'
var swReg         // ServiceWorkerRegistration object
var updateWaiting // true als er een wachtende SW-update is
```

Alle andere bestanden lezen deze variabelen als globals — `var` (geen `let`/`const`) zodat ze beschikbaar zijn over scriptgrenzen heen. Script-laadvolgorde in `index.html`: `version.js → format.js → db.js → render.js → modal.js → app.js`.

### Data (db.js — IndexedDB)

Database: `budget_v1`, object store: `txs`

| Veld     | Type   | Beschrijving                        |
|----------|--------|-------------------------------------|
| id       | Number | Auto-increment primary key          |
| amount   | Number | Bedrag in euro (bijv. 12.50)        |
| cat      | String | Categorie-id (bijv. `'boodschappen'`) |
| date     | String | ISO-datum `'2026-11-23'`            |
| ym       | String | Jaar-maand-index `'2026-11'` (geïndexeerd) |
| desc     | String | Optionele omschrijving              |
| ts       | Number | Tijdstempel (ms, Date.now())        |

Functies:
- `openDB()` — opent of maakt de database aan
- `getTxsByYM(y, m)` — transacties voor één maand ophalen (via `ym`-index)
- `getAllTxs()` — alle transacties (voor export)
- `addTx(data)` — transactie toevoegen
- `delTx(id)` — transactie verwijderen
- `clearAllTxs()` — alle transacties wissen (voor import-vervangen)
- `bulkAddTxs(records)` — meerdere transacties importeren in één transactie

### Categorieën (format.js)

```js
var CATS = [
  { id: 'boodschappen', label: 'Boodschappen', emoji: '🛒', color: '#10B981' },
  { id: 'transport',    label: 'Transport',    emoji: '🚗', color: '#3B82F6' },
  { id: 'horeca',       label: 'Horeca',       emoji: '🍽️', color: '#F59E0B' },
  { id: 'wonen',        label: 'Wonen',        emoji: '🏠', color: '#8B5CF6' },
  { id: 'gezondheid',   label: 'Gezondheid',   emoji: '💊', color: '#EF4444' },
  { id: 'vrije-tijd',   label: 'Vrije tijd',   emoji: '🎮', color: '#EC4899' },
  { id: 'kleding',      label: 'Kleding',      emoji: '👕', color: '#06B6D4' },
  { id: 'overig',       label: 'Overig',       emoji: '📦', color: '#6B7280' },
]
var CMAP // object: { boodschappen: {...}, transport: {...}, ... }
```

### Views (render.js)

Drie async functies die de inhoud van hun view-container vervangen:
- `renderHome()` — saldo-kaart + laatste transacties voor `curY`/`curM`
- `renderTransacties()` — volledige transactielijst voor `curY`/`curM`
- `renderStats()` — donut-chart + staafdiagram per categorie

`render()` in `app.js` roept de juiste renderFunctie op op basis van `activeV`.

### Modal (modal.js)

Eén centrale overlay (`#moverlay`) met een sheet (`#msheet`) en dynamische inhoud (`#mcontent`). Animatie via CSS transition (opacity + translateY).

- `openAdd()` — formulier voor nieuwe transactie
- `openDetail(id, txs)` — transactie-detail + twee-staps verwijderen (geen `confirm()`)
- `openSettings()` — versie-info, update-flow, export en import
- `_doImport(txs, replace)` — voert de daadwerkelijke import uit

### Service Worker & Updates (sw.js + app.js)

De service worker cacht alle app-bestanden bij installatie. De cache-naam bevat de versie (`budget-2026.11.23`), zodat bij een nieuwe versie de oude cache automatisch wordt verwijderd.

Update-flow:
1. Gebruiker tikt "Controleren op updates" in Instellingen
2. `checkUpdate()` roept `swReg.update()` aan en wacht op installatie
3. Als er een nieuwe versie is: `updateWaiting = true`, knoptekst verandert
4. Tweede tik → `applyUpdate()` → stuurt `skipWaiting` naar de wachtende SW → pagina herlaadt

### Versie-nummering

`js/version.js` en de cache-naam in `sw.js` worden automatisch bijgewerkt bij elke push naar `main` via GitHub Actions (`.github/workflows/version.yml`). Pushes naar die twee bestanden zelf worden genegeerd om een oneindige loop te voorkomen.

---

## Export & Import

### Exporteren
Instellingen → "Exporteer data" — downloadt een JSON-bestandje:
```json
{
  "version": "2026.11.23",
  "exported": "2026-11-23T10:00:00.000Z",
  "transactions": [ { "id": 1, "amount": 12.50, ... } ]
}
```

### Importeren
Instellingen → "Importeer data" — selecteer een eerder geëxporteerd JSON-bestandje.
- **Samenvoegen**: voegt de transacties toe aan de bestaande data
- **Vervangen**: wist alle bestaande transacties en importeert de nieuwe

---

## Ontwikkelen

Bestanden bewerken in `C:\Users\DiegoCouwenbergh\Documents\Persoonlijk\BudgetApp\`, committen en pushen naar `main`. GitHub Actions bijwerkt de versie automatisch en GitHub Pages publiceert de update binnen ~1 minuut.

```bash
git add .
git commit -m "feat: omschrijving van de wijziging"
git push
```

> Na een push: open de app → Instellingen → "Controleren op updates" → herladen.

---

## Problemen oplossen

**Knoppen werken niet / scherm is leeg:**
Safari heeft de oude versie gecached via de service worker. Oplossing:
1. Instellingen → "Controleren op updates" → herladen
2. Of: Safari → Instellingen → Geavanceerd → Websitedata → Verwijder data voor deze site → heropen de app

**Updates verschijnen niet:**
De service worker kan alleen updaten als de app via HTTPS (GitHub Pages) is geopend, niet via een lokaal bestand.
