# Changelog

Alle wijzigingen per feature, gesorteerd van nieuwste naar oudste.
Formaat: `[versie] dag/maand/jaar uu:mm — beschrijving`

---

## [feat/push-notifications] — 24/11/2026

### ✨ Nieuw
- **Meldingen** — schakel browser-notificaties in via Instellingen → Meldingen. Je ontvangt een melding zodra een budgetdoelstelling 80% (of meer) bereikt. Toestemming wordt gevraagd via een knop (vereist op iOS). Meldingen worden eenmalig per doelstelling per maand gestuurd. Op ondersteunde browsers (iOS PWA geïnstalleerd op beginscherm, Chrome, Firefox) werkt dit ook via de service worker.

---

## [feat/split-transaction] — 24/11/2026

### ✨ Nieuw
- **Transactie opdelen** — klik "⊕ Opdelen" in het uitgaven-formulier om het totaalbedrag over meerdere categorieën te verdelen. Elke rij heeft een eigen bedrag en categorie. Een "Nog te verdelen" indicator toont het restant. Op opslaan worden N losse transacties aangemaakt.

---

## [feat/recurring-income] — 24/11/2026

### ✨ Nieuw
- **Terugkerende inkomsten** — domicilieringen ondersteunen nu ook inkomsten (bijv. loon). Keuze via type-toggle (Uitgave / Inkomst) bij aanmaken. Inkomsten tonen een groene +bedrag in de lijst en maken automatisch een inkomenst-transactie aan op de ingestelde dag.

---

## [feat/tags] — 24/11/2026

### ✨ Nieuw
- **Tags** — voeg vrije tekst-labels toe aan transacties (kommagescheiden). Tags zijn zichtbaar als chips in de transactielijst en worden meegenomen in de zoekfunctie. Tags kunnen ook bewerkt worden via "Bewerken".

---

## [feat/csv-export] — 24/11/2026

### ✨ Nieuw
- **CSV-export** — exporteer alle transacties als CSV-bestand (puntkomma-gescheiden, UTF-8 BOM voor Excel op nl-BE). Kolommen: Datum (dd/mm/yyyy), Type, Categorie, Omschrijving, Bedrag. Knop staat in Instellingen → Data beheer.

---

## [feat/rollover] — 24/11/2026

### ✨ Nieuw
- **Rollover-dialoog** — bij het openen van de app wordt gecontroleerd of de vorige maand een positief overschot had (inkomsten − uitgaven). Als dat zo is, verschijnt er eenmalig een dialoog: overschot meenemen als inkomst, overschrijven naar een spaarrekening naar keuze, of negeren. Keuze wordt bijgehouden via localStorage.
- **Spaarrekening verwijderen geblokkeerd** — een spaarrekening met saldo > €0 kan niet verwijderd worden; er verschijnt een inline foutmelding met het huidig saldo.
- **Negatief saldo geblokkeerd** — een uitgave of overschrijving die de bronrekening negatief zou maken wordt geblokkeerd met een inline melding "Onvoldoende saldo".

---

## [feat/search-transactions] — 23/11/2026

### ✨ Nieuw
- **Zoeken in transacties** — zoekbalk boven de transactielijst filtert live op omschrijving of categorienaam (hoofdletterongevoelig). Lege zoekterm toont alle transacties; geen resultaten geeft een duidelijke melding.

---

## [feat/edit-transaction] — 23/11/2026

### ✨ Nieuw
- **Transactie bewerken** — klik op een transactie en druk op "Bewerken" om bedrag, datum, categorie en omschrijving te wijzigen. Inline bevestiging ("Wil je deze wijziging opslaan?") vóór opslaan, zonder `confirm()`-dialoog. Overschrijvingen kunnen niet bewerkt worden.

### 🧪 Tests
- 2 nieuwe tests voor `updateTx` in db.test.js (aanpassen + id behoud).

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
