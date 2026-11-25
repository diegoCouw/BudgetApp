# Prospero

[![CI / Deploy](https://github.com/diegoCouw/BudgetApp/actions/workflows/ci.yml/badge.svg)](https://github.com/diegoCouw/BudgetApp/actions/workflows/ci.yml)

Persoonlijke budget- en spaartrackerapp voor één gebruiker. Lokale data op het apparaat (IndexedDB), bankintegratie via een cloud-backend (Azure + Neon PostgreSQL).

**Kernfunctionaliteit:** dagelijkse bank pull → push notificatie → transacties categoriseren.

**Productie (PWA):** [https://diegocouw.github.io/BudgetApp/](https://diegocouw.github.io/BudgetApp/)

---

## Monorepo-structuur

```
BudgetApp/
├── pwa/                        # Vanilla JS PWA — live op GitHub Pages
│   ├── index.html
│   ├── sw.js                   # Service Worker, cache-naam = budget-{APP_VERSION}
│   ├── manifest.json
│   ├── css/app.css
│   ├── js/
│   │   ├── version.js          # APP_VERSION — handmatig bijwerken bij release (semver)
│   │   ├── format.js           # Helpers: eur(), ymKey(), fmtDay(), esc(), categorieën
│   │   ├── db.js               # IndexedDB-wrapper (5 stores)
│   │   ├── render.js           # View-renderers (home, transacties, statistieken)
│   │   ├── modal.js            # Modal + swipe-to-dismiss
│   │   ├── bank.js             # Bank tab: login, koppelen, sync, categoriseren
│   │   └── app.js              # Boot, global state, service worker
│   └── icons/
│
├── app/
│   ├── frontend/               # Angular 22 + Capacitor (toekomstige native app — niet actief)
│   │
│   └── backend/                # ASP.NET Core 11 Minimal API
│       ├── Endpoints/
│       │   ├── AuthEndpoints.cs    POST /auth/login
│       │   ├── BankEndpoints.cs    POST /bank/connect, GET /bank/callback,
│       │   │                       GET /bank/sync, GET /transactions,
│       │   │                       PATCH /transactions/{id}/category
│       │   ├── PushEndpoints.cs    POST /push/subscribe, DELETE /push/subscribe,
│       │   │                       POST /push/notify
│       │   └── HealthEndpoints.cs  GET /health, GET /health/db
│       ├── Services/
│       │   ├── TokenService.cs             JWT generatie (HS256, 60 min)
│       │   ├── EnableBankingService.cs     Enable Banking API-wrapper
│       │   ├── BankSessionStore.cs         Database-backed sessie store
│       │   └── PushNotificationService.cs  Web Push via VAPID
│       ├── Data/
│       │   ├── AppDbContext.cs         EF Core DbContext
│       │   └── Entities.cs            TransactionEntity, BankSessionEntity, PushSubscriptionEntity
│       ├── Migrations/                EF Core migrations (auto-apply bij deploy)
│       ├── Program.cs                 DI, CORS, JWT, auto-migrate
│       └── Dockerfile                 Multi-stage build, poort 8080
│
├── tests/                      # Jest unit tests voor pwa/js/
│   ├── format.test.js
│   └── db.test.js
│
├── app/Prospero.slnx           # Visual Studio solution
└── .github/workflows/
    ├── ci.yml                  # Tests + deploy PWA naar GitHub Pages
    ├── deploy-backend.yml      # Docker build + deploy naar Azure Container Apps
    └── daily-sync.yml          # Cron 06:00 UTC: bank sync + push notificatie
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
| `main` (major) | `/BudgetApp/vN/` | Archief van vorige major versies |

Bij push naar `main` deployt de CI automatisch naar productie.  
Bij een major versie-bump archiveert de CI de huidige productie naar `/vN/`.

> **Deploy flow:** feature branch → PR naar `main` → merge → automatische deploy.

---

## Backend

De ASP.NET Core backend draait op **Azure Container Apps** (North Europe — Dublin).  
Zie [AZURE.md](AZURE.md) voor de volledige setup, secrets-beheer en kostenoverzicht.

**Backend URL:** `https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io`

| Endpoint | Auth | Beschrijving |
|---|---|---|
| `GET /health` | Nee | Health check + versie |
| `GET /health/db` | Nee | DB-connectie + migraties check (CI/CD pipeline) |
| `POST /auth/login` | Nee | Wachtwoord → JWT token (60 min) |
| `POST /bank/connect` | JWT | Start Enable Banking consent flow → redirect-URL naar bank |
| `GET /bank/callback` | Nee | Ontvangt OAuth2 code → wisselt in voor session, slaat accounts op |
| `GET /bank/sync` | JWT | Haalt nieuwe transacties op (params: `from`, `to` als `yyyy-MM-dd`) |
| `GET /transactions` | JWT | Geeft opgeslagen transacties terug (filter: `from`, `to`, `category`) |
| `PATCH /transactions/{id}/category` | JWT | Stelt categorie in op een transactie |
| `POST /push/subscribe` | JWT | Slaat Web Push subscription op |
| `DELETE /push/subscribe` | JWT | Verwijdert Web Push subscription |
| `POST /push/notify` | JWT | Stuurt push notificatie naar alle subscribers |

Alle secrets staan uitsluitend als **Azure Container App secrets** — nooit in code of git.  
De container schaalt naar nul bij inactiviteit (geen kosten). Cold start: ~3 seconden.

---

## Database

Bankgegevens worden opgeslagen in **Neon.tech** (gratis forever tier, PostgreSQL, EU Central — Frankfurt).  
PWA-data (budgetten, categorieën, etc.) staat **lokaal** op het apparaat in IndexedDB.

| Tabel | Beschrijving |
|---|---|
| `Transactions` | Bankbetalingen — id, bedrag, datum, omschrijving, categorie |
| `BankSessions` | Enable Banking OAuth2 sessie — geldig 90 dagen |
| `PushSubscriptions` | Web Push subscriptions — endpoint + VAPID keys van de browser |

De database wordt automatisch gemigreerd bij elke deploy (`db.Database.Migrate()`).  
Verbinding via **directe Neon endpoint** (zonder `-pooler`) — de pooler blokkeert EF Core DDL statements.

Connection string formaat (Npgsql key-value — NIET URI-formaat):
```
Host=...;Database=neondb;Username=neondb_owner;Password=...;SSL Mode=Require
```

---

## Ontwikkelworkflow

```bash
# Nieuwe feature
git checkout -b feat/mijn-feature  # of fix/ of chore/

# Werk, commit, push
git add ...
git commit -m "feat: omschrijving"
git push origin feat/mijn-feature

# PR aanmaken naar main
gh pr create --title "feat: omschrijving" --base main

# CI draait tests → goedkeuren → merge
# Automatisch: deploy PWA + backend (als app/backend/ gewijzigd is)
# Automatisch: branch verwijderd na merge
```

**Nooit direct naar `main` pushen** — altijd via PR.

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

76 unit tests voor de PWA-logica (Jest + fake-indexeddb) + 61 backend tests (xUnit + WebApplicationFactory).

```bash
cd BudgetApp          # root van de repo
npm install           # eenmalig
npm test              # alle PWA tests
npm run coverage      # met coverage-rapport

# Backend tests
dotnet test app/backend.Tests/Prospero.Api.Tests.csproj -v minimal
dotnet test app/backend.Tests/Prospero.Api.Tests.csproj /p:CollectCoverage=true  # met coverage check (threshold 75%)
```

PWA coverage: `pwa/js/format.js` en `pwa/js/db.js`.  
Backend coverage: alle endpoints en services, uitgezonderd EF Core migrations en gegenereerde bestanden.

---

## Architectuur PWA

### Global state (pwa/js/app.js)

```js
var curY          // Huidig geselecteerd jaar (Number)
var curM          // Huidig geselecteerde maand, 0-gebaseerd (Number)
var activeV       // Actieve view: 'home' | 'transacties' | 'statistieken' | 'bank'
var swReg         // ServiceWorkerRegistration object
var updateWaiting // true als er een wachtende SW-update is
```

Script-laadvolgorde: `version.js → format.js → db.js → render.js → modal.js → bank.js → app.js`

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

Cache-naam bevat de versie (`budget-1.2.0`) zodat bij een nieuwe versie de oude cache automatisch verdwijnt.

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
| Azure Container App | Enable Banking private key (RSA, base64) | Azure secret — nooit in code of git |
| Azure Container App | Enable Banking application ID | Azure secret — nooit in code of git |
| Azure Container App | Neon PostgreSQL connection string | Azure secret — nooit in code of git |
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
