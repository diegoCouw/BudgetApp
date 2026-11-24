# Changelog

Alle wijzigingen per versie of feature, nieuwste bovenaan.

---

## [develop] — 24/11/2026 — Database & transacties opslaan

### 🗄️ Neon PostgreSQL database
- **Neon.tech** gekozen als gratis PostgreSQL-provider (0.5 GB, forever free, EU Central)
- Entity Framework Core + Npgsql toegevoegd aan backend
- Twee tabellen: `Transactions` (bankbetalingen) en `BankSessions` (OAuth2 sessies)
- Auto-migrate bij opstarten (`db.Database.Migrate()`)
- Connection string opgeslagen als Azure secret `neon-connection-string`
- Directe endpoint (zonder pooler) vereist voor EF Core DDL-compatibiliteit

### 🏦 Bank sync → database
- `/bank/sync` slaat transacties op in Neon, overslaat duplicaten (op `ExternalId`)
- `GET /transactions` endpoint: geeft opgeslagen transacties terug met datum/categorie filter
- `PATCH /transactions/{id}/category` endpoint: stelt categorie in op een transactie
- `BankSessionStore` persisteert nu sessies in database (overleeft container-herstarts)

### 🔧 Enable Banking fixes
- ASPSP-naam configureerbaar via `EnableBanking:AspspName` in appsettings
- Sandbox gebruikt `BBVA` (BNP Fortis staat niet in sandbox) — voor productie instellen via Azure env var
- Amount-parsing fix: sandbox stuurt bedragen als string, productie als number
- Sandbox testcredentials: username `user1`, wachtwoord `1234`, OTP `012345`

---

## [develop] — 24/11/2026 — Bank API integratie

### 🏦 Enable Banking (in ontwikkeling)
- **Enable Banking** gekozen als PSD2-aggregator — directe BNP Fortis API vereist TPP-licentie (niet haalbaar voor persoonlijk gebruik)
- Sandbox applicatie `Prospero` aangemaakt op enablebanking.com
- RSA private key (base64) en Application ID opgeslagen als Azure Container App secrets
- Planned endpoints: `POST /bank/connect` (consent starten), `GET /bank/callback` (token inwisselen), `GET /bank/sync` (dagelijkse pull)
- Consent geldig 90 dagen, daarna vernieuwing via itsme of kaartlezer

### 🔧 Deploy pipeline fixes
- Containerapp naam en resource group hardcoded in workflow (secret-waarden veroorzaakten "does not exist" fout)
- `workflow_dispatch` trigger toegevoegd — workflow kan nu handmatig gestart worden
- Expliciete Azure subscription ingesteld na login (`az account set`)
- Smoke test toegevoegd na deploy: `GET /health` verifieert versie en status

---

## [develop] — 24/11/2026 — Infrastructure & backend

### 🏗️ Architectuur
- **Monorepo-structuur** — codebase gesplitst in `pwa/` (bestaande PWA) en `app/` (nieuwe full-stack app)
- **Angular + Capacitor basis** (`app/frontend/`) — Angular 22, Capacitor geconfigureerd (`be.prospero.app`), SQLite service met 5 tabellen, biometric auth guard. *Capacitor-distributie on hold totdat Apple Developer Account aanwezig is.*
- **ASP.NET Core Minimal API** (`app/backend/`) — .NET 11, JWT Bearer auth, `POST /auth/login`, `GET /health`, CORS voor Angular dev + Capacitor

### ☁️ Azure Container Apps
- Resource group `prospero-rg` aangemaakt (North Europe)
- Container Apps Environment `prospero-env` opgezet
- Container App `prospero-api` aangemaakt (`min-replicas: 0` → schaal naar nul)
- JWT key en wachtwoord hash als Azure secrets (nooit in code)
- Budget alert ingesteld op €1 (geen onverwachte kosten mogelijk)

### ⚙️ CI/CD
- **Multi-omgeving deployment** — `develop` → `/BudgetApp/dev/`, `main` → `/BudgetApp/`
- **Versie-archivering** — bij major versie-bump archiveert CI productie naar `/BudgetApp/vN/`
- **Backend deploy workflow** — bij push naar `main` met wijzigingen in `app/backend/`: Docker build → push naar `ghcr.io` → deploy naar Azure Container Apps
- GitHub Pages omgezet naar `gh-pages` branch (peaceiris/actions-gh-pages)
- Tests draaien nu ook op PRs naar `develop`

### 📖 Documentatie
- README volledig herschreven (monorepo, omgevingen, backend, workflow)
- AZURE.md toegevoegd (setup, kosten, deployment, secrets beheer)
- CHANGELOG bijgewerkt

---

## [1.1.0] — 24/11/2026

### ✨ Nieuw
- **Swipe-to-dismiss** — modals sluiten bij omlaag swipen (alleen als sheet scrollTop === 0)
- **Prospero** — app hernoemd van "Budget" naar "Prospero" met ondertitel "Savings insights"

### 🔢 Versienummering
- Overgestapt op semantische versioning (`major.minor.patch`)
- Automatische versie-bump via GitHub Actions verwijderd (veroorzaakte branch protection conflicten)
- Versie handmatig bijwerken bij elke release via PR

### 🧪 Tests
- 39 → 76 unit tests (uitgebreide coverage voor `format.js` en `db.js`)
- Jest coverage-script toegevoegd (`npm run coverage`)

---

## [feat/push-notifications] — 24/11/2026

### ✨ Nieuw
- **Meldingen** — schakel browser-notificaties in via Instellingen → Meldingen. Melding zodra een budgetdoelstelling 80% (of meer) bereikt. Toestemming gevraagd via knop (vereist op iOS). Werkt via service worker op ondersteunde browsers.

---

## [feat/split-transaction] — 24/11/2026

### ✨ Nieuw
- **Transactie opdelen** — klik "⊕ Opdelen" in het uitgaven-formulier om het totaalbedrag over meerdere categorieën te verdelen. "Nog te verdelen" indicator toont het restant. Op opslaan worden N losse transacties aangemaakt.

---

## [feat/recurring-income] — 24/11/2026

### ✨ Nieuw
- **Terugkerende inkomsten** — domicilieringen ondersteunen nu ook inkomsten (bijv. loon). Type-toggle (Uitgave / Inkomst) bij aanmaken.

---

## [feat/tags] — 24/11/2026

### ✨ Nieuw
- **Tags** — vrije tekst-labels op transacties (kommagescheiden). Zichtbaar als chips in de transactielijst, meegenomen in zoekfunctie.

---

## [feat/csv-export] — 24/11/2026

### ✨ Nieuw
- **CSV-export** — alle transacties exporteren als CSV (puntkomma-gescheiden, UTF-8 BOM voor Excel nl-BE). Kolommen: Datum, Type, Categorie, Omschrijving, Bedrag.

---

## [feat/rollover] — 24/11/2026

### ✨ Nieuw
- **Rollover-dialoog** — bij app-opening: overschot van vorige maand meenemen als inkomst, overschrijven naar spaarrekening, of negeren.
- **Spaarrekening verwijderen geblokkeerd** — spaarrekening met saldo > €0 kan niet verwijderd worden.
- **Negatief saldo geblokkeerd** — uitgave/overschrijving die bronrekening negatief maakt wordt geblokkeerd.

---

## [feat/search-transactions] — 23/11/2026

### ✨ Nieuw
- **Zoeken in transacties** — zoekbalk filtert live op omschrijving of categorienaam (hoofdletterongevoelig).

---

## [feat/edit-transaction] — 23/11/2026

### ✨ Nieuw
- **Transactie bewerken** — klik op een transactie → "Bewerken" om bedrag, datum, categorie en omschrijving te wijzigen. Inline bevestiging zonder `confirm()`-dialoog.

### 🧪 Tests
- 2 nieuwe tests voor `updateTx` in db.test.js.

---

## [2026.11.23] — 23/11/2026

### ✨ Nieuw
- Doelstellingen, Inkomsten, Rekeningen, Overschrijvingen
- Eigen categorieën, Domicilieringen, Datumfilter
- Export & import (JSON)

### 🧪 Tests
- 37 unit tests via Jest + fake-indexeddb

### ⚙️ CI/CD
- GitHub Actions pipeline opgezet
- PR-template en CHANGELOG toegevoegd

---

## [2026.11.22] — initiële versie

### ✨ Nieuw
- PWA-setup: installeerbaar via Safari, werkt offline
- Transacties bijhouden per maand en categorie
- Statistieken: donut-chart en staafdiagram
- Licht/donker thema, in-app updates
- Hosting via GitHub Pages
