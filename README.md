# Prospero

[![CI / Deploy](https://github.com/diegoCouw/BudgetApp/actions/workflows/ci.yml/badge.svg)](https://github.com/diegoCouw/BudgetApp/actions/workflows/ci.yml)

Persoonlijke budget- en spaartrackerapp. Lokale data op het apparaat, bankintegratie via een cloud-backend.

**Productie (PWA):** [https://diegocouw.github.io/BudgetApp/](https://diegocouw.github.io/BudgetApp/)  
**Preview (develop):** [https://diegocouw.github.io/BudgetApp/dev/](https://diegocouw.github.io/BudgetApp/dev/)

---

## Monorepo-structuur

```
BudgetApp/
├── pwa/                        # Vanilla JS PWA — live op GitHub Pages
│   ├── index.html
│   ├── sw.js
│   ├── manifest.json
│   ├── css/app.css
│   ├── js/
│   │   ├── version.js          # Handmatig bijwerken bij release (semver)
│   │   ├── format.js           # Helpers: eur(), ymKey(), fmtDay(), esc(), categorieën
│   │   ├── db.js               # IndexedDB-wrapper (5 stores)
│   │   ├── render.js           # View-renderers (home, transacties, statistieken)
│   │   ├── modal.js            # Modal + swipe-to-dismiss
│   │   └── app.js              # Boot, global state, service worker
│   └── icons/icon.svg
│
├── app/
│   ├── frontend/               # Angular 22 + Capacitor (toekomstige native app)
│   │   ├── src/app/
│   │   │   ├── core/
│   │   │   │   ├── database.ts     SQLite service (5 tabellen, zelfde schema als IndexedDB)
│   │   │   │   ├── auth.ts         Biometric unlock (Face ID / vingerafdruk)
│   │   │   │   └── auth-guard.ts   Route guard → /lock
│   │   │   └── pages/
│   │   │       ├── lock/           Lock screen
│   │   │       └── dashboard/      Dashboard (skelet)
│   │   └── capacitor.config.ts     appId: be.prospero.app
│   │
│   └── backend/                # ASP.NET Core 11 Minimal API
│       ├── Endpoints/
│       │   ├── AuthEndpoints.cs    POST /auth/login
│       │   └── HealthEndpoints.cs  GET /health
│       ├── Services/
│       │   └── TokenService.cs     JWT generatie (HS256)
│       ├── Program.cs              DI, middleware, CORS, JWT configuratie
│       ├── Dockerfile              Multi-stage build, poort 8080
│       └── appsettings.json        Basis config (geen secrets)
│
├── tests/                      # Jest unit tests voor pwa/js/
│   ├── format.test.js
│   └── db.test.js
│
└── .github/workflows/
    ├── ci.yml                  # Tests + deploy PWA naar GitHub Pages
    └── deploy-backend.yml      # Docker build + deploy naar Azure Container Apps
```

---

## PWA installeren op iPhone

1. Open [https://diegocouw.github.io/BudgetApp/](https://diegocouw.github.io/BudgetApp/) in **Safari**
2. Tik op het deel-icoon (vierkantje met pijltje omhoog)
3. Kies **"Voeg toe aan beginscherm"**
4. App opent voortaan als standalone app zonder adresbalk

---

## Omgevingen

| Branch | URL | Doel |
|---|---|---|
| `main` | `/BudgetApp/` | Productie — dagelijks gebruik |
| `develop` | `/BudgetApp/dev/` | Preview — testen voor release |
| `main` (major) | `/BudgetApp/vN/` | Archief van vorige major versies |

Bij merge van `develop` → `main` deployt de CI automatisch naar productie.  
Bij een major versie-bump archiveert de CI de huidige productie naar `/vN/`.

---

## Backend

De ASP.NET Core backend draait op **Azure Container Apps** (North Europe).  
Zie [AZURE.md](AZURE.md) voor de volledige setup en kostenoverzicht.

| Endpoint | Auth | Beschrijving |
|---|---|---|
| `GET /health` | Nee | Health check |
| `POST /auth/login` | Nee | Wachtwoord → JWT token |

Secrets (JWT key, wachtwoord hash) staan uitsluitend als Azure Container App secrets — nooit in code of git.

---

## Ontwikkelworkflow

```
# Nieuwe feature
git checkout develop
git checkout -b feat/mijn-feature

# Werk, commit, push
git add ...
git commit -m "feat: omschrijving"
git push origin feat/mijn-feature

# PR aanmaken → CI draait tests → merge naar develop
# Develop deployt automatisch naar /BudgetApp/dev/ (preview)

# Release naar productie
# PR develop → main + versie bumpen in pwa/js/version.js en pwa/sw.js
# Merge → CI deployt naar /BudgetApp/ (productie)
# CI deployt ook backend naar Azure als app/backend/ gewijzigd is
```

---

## Versienummering

Semantische versioning: `major.minor.patch` in [pwa/js/version.js](pwa/js/version.js) en [pwa/sw.js](pwa/sw.js).

| Increment | Wanneer |
|---|---|
| `major` | Grote herwerking (bijv. backend-migratie) — archiveert oude versie naar `/vN/` |
| `minor` | Nieuwe feature |
| `patch` | Bugfix |

Handmatig bijwerken bij elke release via PR.

---

## Tests

76 unit tests voor de PWA-logica (Jest + fake-indexeddb).

```bash
cd BudgetApp          # root van de repo
npm install           # eenmalig
npm test              # alle tests
npm run coverage      # met coverage-rapport
```

Coverage: `pwa/js/format.js` en `pwa/js/db.js`.  
Angular-tests in `app/frontend/` draaien apart via `ng test`.

---

## Architectuur PWA

### Global state (pwa/js/app.js)

```js
var curY          // Huidig geselecteerd jaar (Number)
var curM          // Huidig geselecteerde maand, 0-gebaseerd (Number)
var activeV       // Actieve view: 'home' | 'transacties' | 'statistieken'
var swReg         // ServiceWorkerRegistration object
var updateWaiting // true als er een wachtende SW-update is
```

Script-laadvolgorde: `version.js → format.js → db.js → render.js → modal.js → app.js`

### IndexedDB (pwa/js/db.js)

Database: `budget_v1` (versie 2), 5 stores:

| Store | Sleutel | Beschrijving |
|---|---|---|
| `txs` | id (auto) | Transacties |
| `categories` | id (auto) | Eigen categorieën |
| `accounts` | id (auto) | Rekeningen |
| `recurring` | id (auto) | Domicilieringen |
| `goals` | id (auto) | Spaar- en budgetdoelen |

### Service Worker & Updates

Cache-naam bevat de versie (`budget-1.1.0`) zodat bij een nieuwe versie de oude cache automatisch verdwijnt.

Update-flow:
1. Instellingen → "Controleren op updates" → `swReg.update()`
2. Nieuwe versie gevonden → `updateWaiting = true`
3. Tweede tik → `skipWaiting` → pagina herlaadt

---

## Beveiliging

### Secrets
| Waar | Wat | Hoe beveiligd |
|---|---|---|
| Azure Container App | JWT signing key | Azure secret — nooit in code of git |
| Azure Container App | Wachtwoord hash (SHA-256) | Azure secret — nooit in code of git |
| GitHub Actions | Azure credentials (Service Principal) | GitHub Secret |
| GitHub Actions | Backend URL | GitHub Secret |

- `appsettings.Production.json` en `appsettings.Local.json` staan in `.gitignore`
- Geen enkel secret zit in de git-history

### Authenticatie backend
- Wachtwoord wordt vergeleken als SHA-256 hash met `FixedTimeEquals` (timing-safe)
- Succesvolle login geeft een kortlevend JWT-token (60 minuten, HS256)
- Bank API-calls verlopen altijd server-side — credentials komen nooit in de PWA terecht

### Azure toegang
- Service Principal `prospero-github` heeft enkel **Contributor** rechten op `prospero-rg`
- Geen toegang tot andere resource groups of subscriptions
- Budget alert op €1 met e-mailnotificatie

### PWA
- Alle data staat lokaal op het apparaat (IndexedDB) — geen account, geen cloud-sync
- Service Worker serveert de app offline vanuit cache

---

## Problemen oplossen

**App toont oude versie:**  
Instellingen → "Controleren op updates" → herladen.  
Of: Safari → Instellingen → Geavanceerd → Websitedata → verwijder data voor deze site.

**Backend niet bereikbaar:**  
De backend schaalt naar nul bij inactiviteit. De eerste aanroep na een stilteperiode duurt ~3 seconden (cold start). Dit is normaal.
