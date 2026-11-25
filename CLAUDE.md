# CLAUDE.md — Prospero BudgetApp

> Context-bestand voor AI-assistenten. Bevat alles wat een nieuwe sessie nodig heeft om meteen mee te werken.
> **Update dit bestand bij elke nieuwe feature, architectuurwijziging of todo-aanpassing.**

---

## Project in één zin

Prospero is een persoonlijke budget-tracker-app voor één gebruiker (Diego). Kernfunctionaliteit: elke ochtend banktransacties binnenpullen → push-notificatie → transacties categoriseren. Cash-invoer en digitale betalingen zijn secundair.

---

## Repositories & live URLs

| Omgeving | URL |
|---|---|
| PWA productie | `https://diegocouw.github.io/BudgetApp/` |
| Backend API | `https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io` |
| GitHub repo | `https://github.com/diegoCouw/BudgetApp` |

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
│   │   ├── version.js          # APP_VERSION — handmatig bijwerken bij release
│   │   ├── format.js           # Helpers: eur(), ymKey(), fmtDay(), esc(), categorieën, _userCats
│   │   ├── db.js               # IndexedDB-wrapper (5 stores: txs, categories, accounts, recurring, goals)
│   │   ├── render.js           # View-renderers: renderHome(), renderTransacties(), renderStats()
│   │   ├── modal.js            # Modal + swipe-to-dismiss
│   │   ├── bank.js             # Bank tab: login, koppelen, sync, categoriseren
│   │   └── app.js              # Boot, global state, service worker
│   └── icons/
│
├── app/
│   ├── frontend/               # Angular 22 + Capacitor (toekomstige native app — niet actief)
│   └── backend/                # ASP.NET Core 11 Minimal API
│       ├── Endpoints/
│       │   ├── AuthEndpoints.cs      POST /auth/login
│       │   ├── BankEndpoints.cs      POST /bank/connect, GET /bank/callback, GET /bank/sync
│       │   │                         GET /transactions, PATCH /transactions/{id}/category
│       │   └── HealthEndpoints.cs    GET /health, GET /health/db
│       ├── Services/
│       │   ├── TokenService.cs       JWT generatie (HS256, 60 min)
│       │   ├── EnableBankingService.cs  Enable Banking API-wrapper (RSA-signed JWTs)
│       │   └── BankSessionStore.cs   DB-backed sessie store — leest/schrijft actieve bank sessie via AppDbContext
│       ├── Data/
│       │   ├── AppDbContext.cs       EF Core DbContext
│       │   └── Entities.cs          TransactionEntity, BankSessionEntity
│       ├── Models/BankModels.cs      BankSession, BankTransaction records
│       ├── Migrations/               EF Core migrations (auto-migrate bij deploy)
│       ├── Program.cs                DI, middleware, CORS, JWT, auto-migrate
│       └── Dockerfile                Multi-stage build, poort 8080
│
├── tests/                      # Jest unit tests voor pwa/js/
│   ├── format.test.js          # Tests voor format.js
│   └── db.test.js              # Tests voor db.js (fake-indexeddb)
│
├── .github/workflows/
│   ├── ci.yml                  # Tests + deploy PWA naar GitHub Pages
│   └── deploy-backend.yml      # Docker build + push naar Azure Container Apps
│
├── app/Prospero.slnx           # Visual Studio solution (opent backend project)
├── README.md                   # Gebruikersdocumentatie
└── CLAUDE.md                   # Dit bestand — AI context
```

---

## Technische stack

| Laag | Technologie |
|---|---|
| PWA | Vanilla JS (TypeScript migratie gepland) |
| Service Worker | Native browser API |
| Lokale database | IndexedDB via eigen wrapper (`db.js`) |
| Backend | ASP.NET Core 11, Minimal API |
| ORM | Entity Framework Core + Npgsql |
| Cloud database | Neon.tech (gratis PostgreSQL, EU Central) |
| Auth | JWT HS256 (60 min), wachtwoord als SHA-256 hash |
| Bank API | Enable Banking (sandbox: BBVA, productie: BNP Fortis) |
| Hosting backend | Azure Container Apps (North Europe, schaal naar nul) |
| Hosting PWA | GitHub Pages |
| CI/CD | GitHub Actions |

---

## Backend endpoints

| Methode | Pad | Auth | Beschrijving |
|---|---|---|---|
| `GET` | `/health` | Nee | Health check + versie |
| `GET` | `/health/db` | Nee | DB-connectie + migraties check (gebruikt door CI/CD pipeline) |
| `POST` | `/auth/login` | Nee | Wachtwoord → JWT token (60 min) |
| `POST` | `/bank/connect` | JWT | Start Enable Banking consent → redirect-URL naar bank |
| `GET` | `/bank/callback` | Nee | OAuth2 code → sessie + accounts opslaan |
| `GET` | `/bank/sync` | JWT | Nieuwe transacties ophalen (params: `from`, `to` als `yyyy-MM-dd`) |
| `GET` | `/transactions` | JWT | Opgeslagen transacties (filter: `from`, `to`, `category`) |
| `PATCH` | `/transactions/{id}/category` | JWT | Categorie instellen op een transactie |

**Authenticatie:** `Authorization: Bearer <jwt>` header. JWT opgeslagen in `localStorage` onder key `prospero_jwt`.

---

## Database schema (Neon PostgreSQL)

```
TransactionEntity
├── Id (int, PK, auto)
├── ExternalId (string) — unieke ID van de bank, deduplicatie
├── AccountId (string) — Enable Banking rekening-UID
├── Amount (decimal)
├── Currency (string, default "EUR")
├── Direction (string) — "CRDT" = inkomst, "DBIT" = uitgave
├── BookingDate (DateOnly)
├── Description (string)
├── Category (string?) — null = ongecategoriseerd
└── CreatedAt (DateTime, default UtcNow)

BankSessionEntity
├── Id (int, PK, auto)
├── SessionId (string) — Enable Banking session ID
├── AccountIdsJson (string) — JSON-array van rekening-UIDs
├── ExpiresAt (DateTime) — 90 dagen geldig
└── CreatedAt (DateTime, default UtcNow)
```

Verbinding via directe Neon endpoint (geen `-pooler`) — pooler is incompatibel met EF Core DDL.  
Connection string formaat (Npgsql key-value): `Host=...;Database=...;Username=...;Password=...;SSL Mode=Require`

---

## Secrets — NOOIT in code of git

Alle secrets staan uitsluitend als **Azure Container App secrets**. Bij wijziging altijd de container herstarten.

| Secret naam (Azure) | Inhoud |
|---|---|
| `jwt-key` | JWT signing key (willekeurig, min. 32 chars) |
| `auth-password-hash` | SHA-256 hex van het wachtwoord |
| `enablebanking-app-id` | Enable Banking application UUID |
| `enablebanking-private-key-base64` | RSA private key als base64 |
| `neon-connection-string` | Npgsql key-value connection string |
| `enablebanking-callback-url` | Callback URL voor OAuth2 flow |

**Bestanden die NOOIT gecommit mogen worden:**
- `appsettings.Production.json`
- `appsettings.Local.json`
- Beide staan in `.gitignore`

---

## Enable Banking flow

```
1. POST /bank/connect  →  EnableBankingService.StartConsentAsync()
   - Genereert RSA-signed JWT als Bearer token
   - POST naar https://api.enablebanking.com/auth
   - Geeft redirect-URL terug naar de bank (bijv. BBVA sandbox)

2. Gebruiker logt in bij bank en geeft toestemming

3. GET /bank/callback?code=...  →  EnableBankingService.CreateSessionAsync()
   - Wisselt OAuth2 code in voor sessie-ID + rekening-UIDs
   - Sessie geldig 90 dagen, opgeslagen in BankSessionStore (database-backed via BankSessions tabel)

4. GET /bank/sync?from=...&to=...  →  EnableBankingService.GetTransactionsAsync()
   - Haalt transacties op per rekening
   - Sloeg 422-fouten op bij grote datumbereiken (BBVA sandbox)
   - Dubbels worden overgeslagen via ExternalId check
```

**Let op:** BankSessionStore is database-backed (opgeslagen in de BankSessions tabel). Sessies blijven bewaard na container-herstart.

---

## PWA bank tab (pwa/js/bank.js)

```
BACKEND = 'https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io'

Functies:
- getToken() / setToken() / clearToken()  — JWT in localStorage['prospero_jwt']
- apiCall(method, path, body)             — authenticated fetch, 401 → clearToken()
- renderBank()                            — entry: check token → login of main
- renderBankLogin()                       — login form met wachtwoord-toggle (oog-icoon)
- doLogin()                               — POST /auth/login, JWT opslaan
- renderBankMain()                        — koppelen, sync, uitloggen
- doConnect()                             — POST /bank/connect → redirect naar bank
- doSync()                                — GET /bank/sync (30 dagen bereik)
- loadBankTxs()                           — GET /transactions → filter + lijst
- renderBankCatFilter()                   — horizontale filter-chips per categorie
- renderBankTxList(search)                — transactielijst, gekleurde badges, paginering
- openCategoryPicker(txId, labelEl)       — modal met emoji-chips, eigen invoer, wissen
- setCategory(txId, cat, labelEl)         — PATCH /transactions/{id}/category
```

---

## PWA — Laadvolgorde scripts

```html
version.js → format.js → db.js → render.js → modal.js → bank.js → app.js
```

---

## PWA — Versioning

Versie staat in `pwa/js/version.js` (`APP_VERSION`) en `pwa/sw.js` (cache-naam `budget-{versie}`).  
**Bij elke release handmatig bijwerken in beide bestanden.**

Huidig: `1.2.0`

| Increment | Wanneer |
|---|---|
| `major` | Grote herwerking — archiveert oude versie naar `/vN/` |
| `minor` | Nieuwe feature |
| `patch` | Bugfix |

---

## CORS — toegestane origins

Geconfigureerd in `Program.cs`, policy `"frontend"`:
- `https://diegocouw.github.io` (PWA GitHub Pages)
- `http://localhost:4200` (Angular dev server)
- `capacitor://localhost` (Capacitor iOS)
- `http://localhost` (Capacitor Android)

---

## Git workflow — STRIKT EN NIET-ONDERHANDELBAAR

```
feature branch  →  PR naar main  →  merge  →  automatische deploy
```

- **NOOIT direct naar main pushen** — altijd via PR, ook voor kleine fixes
- Develop-branch is afgeschaft (singledev privé app, geen preview-omgeving nodig)
- Uitzonderingen vereisen **expliciete toestemming van de gebruiker**
- Na elke PR-merge: README en CLAUDE.md bijwerken als de inhoud veranderd is
- Branch-naamgeving: `feat/naam`, `fix/naam`, `chore/naam`
- Branches worden automatisch verwijderd na merge (GitHub auto-delete ingeschakeld + cleanup-job in ci.yml)

### PR aanmaken via gh CLI

```powershell
$body = @'
## Summary
- Beschrijving van wat er gedaan is

## Test plan
- [ ] Stap 1
- [ ] Stap 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
'@
gh pr create --title "feat: omschrijving" --body $body --base main
```

---

## CI/CD

### ci.yml (GitHub Actions)
- Triggert op push naar `main` en PR naar `main`
- Tests: `npm ci` → `npm test`
- Deploy PWA: bij push naar `main` → `/BudgetApp/` (productie)
- Na succesvolle deploy: `cleanup-branches` job verwijdert alle gemergte branches automatisch

### deploy-backend.yml (GitHub Actions)
- Triggert op push naar `main` als `app/backend/**` gewijzigd is
- Stappen: Docker build → push naar ghcr.io → `az containerapp update`
- Na deploy:
  1. Retry loop wacht tot container bereikbaar is (max 60s)
  2. `[Azure]` Container App health check (`GET /health`) — gelogd in pipeline
  3. `[Neon]` Database health check (`GET /health/db`) — connectie + migrations gelogd
- Secrets nodig: `AZURE_CREDENTIALS`, `REGISTRY_LOGIN_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `BACKEND_URL`

---

## Tests

76 unit tests voor de PWA-logica (Jest + fake-indexeddb).

```bash
cd BudgetApp   # root van de repo
npm install    # eenmalig
npm test       # alle tests
npm run coverage
```

Coverage: `pwa/js/format.js` en `pwa/js/db.js`.

---

## Technische voorkeuren

- **TypeScript** boven vanilla JS voor alle frontend code (migratie gepland)
- Geen onnodige comments in code — alleen als de WHY niet-obvious is
- Geen extra abstracties of features buiten de taak om
- Altijd **waarschuwen vóór acties die Azure-kosten of proefkrediet verbruiken**

---

## TODO-lijst (bijwerken bij elke sessie)

### In uitvoering
*(geen)*

### Te doen — geprioriteerd
1. **Error handling & logging** — try-catch op alle endpoints, gestructureerde logging (Serilog), raadpleegbaar in Azure + browser
2. **What's new scherm** — na app-update kort venster met nieuwe features, enkel als er nieuws is
3. **Service health warnings** — in-app waarschuwing als bank consent vervalt, secrets oud zijn
4. **Dagelijkse automatische bank sync** — cron job elke ochtend
5. **Push notificaties** — melding als nieuwe betalingen klaarstaan om te categoriseren
6. **Maandoverzicht** — per categorie uitklappen + totaalsom, maaltijdcheques apart
7. **Maandrapport** — einde maand overzicht: top 3 uitgaven, gespaarde bedrag, vergelijking vorige maand
8. **Transactie opsplitsen** — één transactie onder meerdere categorieën
9. **Digitale transacties wissen** — clear DB voor geselecteerde rekeningen met bevestigingsdialoog
10. **Code coverage ~100%** — unit tests voor alle backend endpoints en services
11. **PWA migreren naar TypeScript**
12. **Bank API koppeling productie** — echte BNP Fortis app aanmaken op enablebanking.com
13. **Pluxee publieke API onderzoeken** — maaltijdcheques rekening
14. **Backup knop** — exporteer data naar iPhone Bestanden-app
15. **Cash betalingen manueel invoeren**
16. **Frontend migratie naar Angular**
17. **Redesign van de app**

### Afgerond
- ✅ Neon PostgreSQL tabellen aanmaken (EF Core migrations, key-value connection string)
- ✅ Transacties opslaan in database via backend
- ✅ Enable Banking koppeling (sandbox BBVA)
- ✅ Bank tab in PWA (login, koppelen, sync)
- ✅ Wachtwoord toggle (oog-icoon) op loginscherm
- ✅ Transacties categoriseren (emoji, kleuren, filterbar, eigen categorie)
- ✅ CORS toegang GitHub Pages
- ✅ Visual Studio solution file (Prospero.slnx)
- ✅ Bank koppeling afmelden — `DELETE /bank/session`, inline twee-stap bevestiging in PWA (v1.3.0)
- ✅ DB migration check — `/health/db` endpoint controleert connectie + pending migrations
- ✅ Documentatie map — 8 gidsen in `docs/`, `.claude/skills/update-docs.md`
- ✅ Deploy flow vereenvoudigd — enkel main, geen develop meer, health checks na deploy
- ✅ Branch cleanup — auto-delete na merge (GitHub instelling + ci.yml cleanup-job)

---

## Azure — infrastructuur

### Rol in het project
Azure Container Apps host de **ASP.NET Core backend**. De backend is de brug tussen de PWA en de bank API + database. Zonder backend werkt de bank tab niet.

### Resources (resource group: `prospero-rg`, regio: North Europe / Dublin)

| Resource | Type | Beschrijving |
|---|---|---|
| `prospero-env` | Container Apps Environment | Beheerde infrastructuur voor containers |
| `prospero-api` | Container App | De ASP.NET Core backend, poort 8080 |

### Container App configuratie

- **min-replicas: 0** → schaalt naar nul bij inactiviteit = geen kosten bij geen gebruik
- **Cold start:** ~3 sec bij eerste aanroep na stilteperiode — normaal gedrag
- **Rolling update:** GitHub Actions deployt automatisch zonder downtime
- **HTTPS** wordt afgehandeld door Azure Container Apps, niet door de container zelf

### Azure CLI (PowerShell)

```powershell
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
az login  # opent browser
```

### Secrets beheren

Secrets staan uitsluitend op `prospero-api`. **Na wijziging altijd de container herstarten.**

```powershell
# Secret instellen
az containerapp secret set --name prospero-api --resource-group prospero-rg --secrets "naam=waarde"

# Container herstarten (secrets activeren)
az containerapp revision restart --name prospero-api --resource-group prospero-rg --revision <actieve-revisie>
```

Actieve revisie opvragen:
```powershell
az containerapp revision list --name prospero-api --resource-group prospero-rg --query "[?properties.active].name" -o tsv
```

### Wachtwoord wijzigen (stappen)

```powershell
# 1. Genereer nieuwe SHA-256 hash
$ww = "nieuw-wachtwoord"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($ww)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString("x2") }) -join ""

# 2. Stel in op Azure
az containerapp secret set --name prospero-api --resource-group prospero-rg --secrets "auth-password-hash=HASH_HIER"
```

### Deployment pipeline

```
Push naar main (met wijzigingen in app/backend/)
  → .github/workflows/deploy-backend.yml
  → Docker multi-stage build (.NET 11)
  → Push naar ghcr.io/diegocouw/prospero-api:latest
  → az containerapp update
  → Wacht op container start (retry loop, max 60s)
  → [Azure] Container App health check: GET /health (gelogd in pipeline)
  → [Neon] Database health check: GET /health/db (connectie + migrations, gelogd)
```

### GitHub Secrets (vereist voor CI/CD)

| Secret | Inhoud |
|---|---|
| `AZURE_CREDENTIALS` | Service principal JSON (Contributor op `prospero-rg`) |
| `AZURE_RESOURCE_GROUP` | `prospero-rg` |
| `AZURE_CONTAINERAPP_NAME` | `prospero-api` |
| `AZURE_LOCATION` | `northeurope` |
| `BACKEND_URL` | Backend URL |

### Kosten

Azure Container Apps free tier (maandelijks):

| Limiet | Bij 1 call/dag | % benut |
|---|---|---|
| 180.000 vCPU-seconden | ~0,09 sec | ~0% |
| 360.000 GiB-seconden | verwaarloosbaar | ~0% |
| 2.000.000 requests | ~30 | ~0% |

Na proefperiode (€200 / 30 dagen) blijven gratis limieten actief. Azure schakelt **nooit automatisch over naar betaald**. Budget alert staat op €1 met e-mailnotificatie.

> **Waarschuwing voor AI-assistenten:** waarschuw de gebruiker altijd vóór acties die Azure-kosten of proefkrediet verbruiken.

---

## Neon PostgreSQL — database

### Rol in het project
Neon slaat alle **bankgegevens** op die de backend verwerkt: gesyncte transacties en bank-sessie-informatie. De PWA-data (budgetten, categorieën, etc.) staat **lokaal** in IndexedDB op het apparaat.

### Configuratie

| Instelling | Waarde |
|---|---|
| Project | `prospero` |
| Database | `neondb` |
| Branch | `production` (default) |
| Regio | EU Central (Frankfurt) |
| Tier | Free forever (geen kosten) |
| Endpoint type | **Direct** (zonder `-pooler`) |

### Waarom directe endpoint en geen pooler?
EF Core migrations voeren DDL-statements uit (`CREATE TABLE`, `ALTER TABLE`). De Neon pooler staat dit niet toe. Gebruik altijd de directe endpoint in de connection string.

### Connection string formaat (Npgsql key-value — NIET URI)

```
Host=ep-broad-base-bg7bdcke.c-9.eu-central-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=WACHTWOORD;SSL Mode=Require
```

**FOUT** (URI-formaat — werkt niet, password verschijnt ook in logs):
```
postgresql://neondb_owner:PASSWORD@host/neondb?sslmode=require
```

### Connection string instellen op Azure

```powershell
az containerapp secret set `
  --name prospero-api `
  --resource-group prospero-rg `
  --secrets "neon-connection-string=Host=ENDPOINT;Database=neondb;Username=neondb_owner;Password=WACHTWOORD;SSL Mode=Require"
```

### Wachtwoord resetten

Via Neon dashboard → **Settings** → **Reset password**. Daarna direct het Azure secret bijwerken en container herstarten.

### Neon dashboard
`https://console.neon.tech` → project `prospero` → branch `production`
- **Tables**: bekijk/bewerk data direct
- **SQL editor**: query's uitvoeren (handig voor debuggen)
- **Connection Details**: haal endpoint + credentials op (zet pooler op OFF)

### Auto-migrate
Bij elke deploy voert de backend automatisch `db.Database.Migrate()` uit. Nieuwe EF Core migrations worden zo altijd toegepast zonder handmatige stappen.

---

## Bekende beperkingen / gotchas

- **BankSessionStore is database-backed**: sessie blijft bestaan na container-herstart (opgeslagen in BankSessions tabel)
- **BBVA sandbox 422**: geeft 422 bij datumbereiken > ~60 dagen — afgehandeld door fout te loggen en lege lijst terug te geven
- **Neon connection string**: MOET key-value formaat zijn (`Host=...;Database=...`), NIET URI-formaat (`postgresql://...`)
- **Azure Container Apps**: secrets vereisen een container-herstart om van kracht te worden
- **Cold start**: backend schaalt naar nul bij inactiviteit — eerste aanroep duurt ~3 seconden
- **BankSessionEntity**: database-opslag volledig actief via BankSessionStore (geen in-memory meer)
- **Neon direct endpoint**: gebruik altijd `ep-broad-base-bg7bdcke.c-9.eu-central-1.aws.neon.tech` (zonder `-pooler`) voor EF Core migrations

---

## Geschiedenis van opgeloste problemen

| Probleem | Oorzaak | Oplossing |
|---|---|---|
| Neon tabellen niet aangemaakt | URI-formaat connection string — Npgsql vereist key-value | Key-value formaat instellen als Azure secret |
| Wachtwoord in Azure logs | URI-format bevatte wachtwoord in plaintext in foutmelding | Key-value formaat + Neon wachtwoord gereset |
| CORS geblokkeerd vanuit GitHub Pages | `https://diegocouw.github.io` niet in allowlist | Toegevoegd aan `Program.cs` |
| Enable Banking 422 bij grote datumbereiken | BBVA sandbox accepteert geen bereiken > ~60 dagen | `EnsureSuccessStatusCode()` vervangen door graceful error handling |
| `gh pr create` met speciale tekens in PowerShell | `<<'EOF'` werkt niet in PowerShell | `$body = @'...'@` multiline string gebruiken |
