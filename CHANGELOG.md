# Changelog

Alle wijzigingen per feature, gesorteerd van nieuwste naar oudste.
Formaat: `[versie] dag/maand/jaar uu:mm — beschrijving`

---

## [2026.11.23] — 23/11/2026

### ✨ Nieuw
- **Doelstellingen** — budgetdoelen per categorie, totaal maandbudget, spaardoelstelling en aangepaste periodes. Voortgang zichtbaar op het startscherm met kleurgecodeerde progressiebalk (groen / oranje / rood).
- **Inkomsten** — transacties hebben nu een type: Uitgave, Inkomst of Overschrijving.
- **Rekeningen** — zichtrekening (automatisch aangemaakt) en vrij aan te maken spaarrekeningen. Saldo berekend vanuit transactiehistoriek.
- **Overschrijvingen** — bedragen verplaatsen tussen zichtrekening en spaarrekeningen.
- **Eigen categorieën** — zelf categorieën aanmaken met label, emoji en kleur via Instellingen.
- **Domicilieringen** — vaste maandelijkse betalingen die automatisch worden aangemaakt op de ingestelde dag.
- **Datumfilter** — transacties filteren op een vrij datumbereik (Van–Tot) naast de bestaande maandnavigatie.
- **Export & import** — data exporteren als JSON-backup en importeren (samenvoegen of vervangen).

### 🧪 Tests
- 37 unit tests voor `format.js` en `db.js` via Jest + fake-indexeddb.

### ⚙️ CI/CD
- GitHub Actions pipeline: Tests → Versie bijwerken → GitHub Pages deploy.
- Pipeline-statusbadge in README.
- PR-template en CHANGELOG toegevoegd.

### 🐛 Fixes
- CSS specificity bug: modal overlay blokkeerde alle knoppen (`[hidden] { display: none !important }`).
- Syntax error in GitHub Actions workflow (f-string in subshell).
- Updates worden nu automatisch toegepast zonder handmatige stap.

---

## [2026.11.22] — initiële versie

### ✨ Nieuw
- PWA-setup: installeerbaar via Safari, werkt offline via service worker.
- Transacties bijhouden per maand en categorie (8 ingebouwde categorieën).
- Statistieken: donut-chart en staafdiagram per categorie.
- Licht/donker thema.
- In-app updates via Instellingen.
- Automatische versienummering (`jaar.maand.dag`) bij elke push via GitHub Actions.
- Hosting via GitHub Pages.
