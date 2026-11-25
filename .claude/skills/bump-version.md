# bump-version — Versienummer bijwerken voor Prospero

Gebruik deze skill om de PWA-versie te verhogen en te koppelen aan een git commit.

## Regels

Versie staat op **twee plaatsen** — beide moeten altijd overeenkomen:
1. `pwa/js/version.js` → `var APP_VERSION = 'x.y.z';`
2. `pwa/sw.js` → eerste regel: `const CACHE = 'budget-x.y.z';`

Semantische versioning: `major.minor.patch`

| Increment | Wanneer |
|---|---|
| `major` | Grote herwerking (backend-migratie, design overhaul, API-breuk) |
| `minor` | Nieuwe feature zichtbaar voor de gebruiker |
| `patch` | Bugfix, kleine tekstaanpassing, performance |

## Procedure

### Stap 1 — Huidige versie lezen

```bash
grep APP_VERSION pwa/js/version.js
grep "const CACHE" pwa/sw.js
```

### Stap 2 — Nieuwe versie bepalen

Bepaal het increment op basis van wat er in dit PR/commit gewijzigd is:
- Nieuwe knop, scherm of flow zichtbaar voor gebruiker → `minor`
- Bugfix of interne change zonder gebruikerseffect → `patch`
- Volledige herwerking, incompatibele wijziging → `major`

### Stap 3 — Beide bestanden bijwerken

Pas `pwa/js/version.js` aan:
```javascript
var APP_VERSION = 'x.y.z';  // nieuwe versie
```

Pas `pwa/sw.js` aan (eerste regel):
```javascript
const CACHE = 'budget-x.y.z';  // zelfde versie
```

### Stap 4 — CLAUDE.md bijwerken

Zoek `Huidig: \`x.y.z\`` in CLAUDE.md en pas aan naar de nieuwe versie.

### Stap 5 — Versie vermelden in commit message

Voeg de versie toe aan het commit bericht:
```
feat: korte omschrijving (v1.3.0)
```

## Wanneer versie NIET verhogen

- Bij pure backend-only wijzigingen (geen PWA-bestanden gewijzigd)
- Bij documentatie-only wijzigingen (README.md, CLAUDE.md, docs/)
- Bij test-only wijzigingen

## Voorbeeld

Feature "push notificaties" (zichtbaar voor gebruiker) → minor bump:

```javascript
// pwa/js/version.js
var APP_VERSION = '1.3.0';

// pwa/sw.js (regel 1)
const CACHE = 'budget-1.3.0';
```

Commit:
```
feat: Web Push notificaties via VAPID (v1.3.0)
```
