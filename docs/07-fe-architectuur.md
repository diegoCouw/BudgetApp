# Angular frontend — architectuur (toekomstig)

> **Status:** Skelet aanwezig, niet actief in gebruik. De huidige productie-interface is de PWA (zie [05-pwa-architectuur.md](05-pwa-architectuur.md)). De Angular app is gepland als vervanging voor de PWA.

---

## Locatie

```
app/frontend/
```

---

## Tech stack

| Technologie | Versie | Rol |
|---|---|---|
| Angular | 22 | Framework |
| Capacitor | Recente versie | Native wrapper (iOS/Android) |
| SQLite (via Capacitor) | — | Lokale database op het apparaat |

**App ID:** `be.prospero.app`

---

## Bestandsstructuur (skelet)

```
app/frontend/
├── src/
│   └── app/
│       ├── core/
│       │   ├── database.ts     SQLite service (5 tabellen, zelfde schema als IndexedDB)
│       │   ├── auth.ts         Biometric unlock (Face ID / vingerafdruk)
│       │   └── auth-guard.ts   Route guard → /lock
│       └── pages/
│           ├── lock/           Lock screen
│           └── dashboard/      Dashboard (skelet)
├── capacitor.config.ts         appId: be.prospero.app
└── package.json
```

---

## Geplande voordelen t.o.v. PWA

- **Native biometrie** — Face ID / Touch ID via Capacitor
- **SQLite** — betrouwbaarder dan IndexedDB, betere query-mogelijkheden
- **TypeScript first** — geen migratie nodig
- **Angular routing** — betere navigatiestructuur
- **Capacitor plugins** — push notificaties, bestanden, achtergrondtaken

---

## Migratiestrategie (backlog)

1. Database-schema van IndexedDB overnemen in SQLite (5 tabellen)
2. Views één voor één migreren (home, transacties, statistieken, bank)
3. Bank tab koppelen aan dezelfde backend-API
4. PWA uitfaseren na succesvolle migratie

---

## Releaseplan (zonder Apple Developer account)

> Zie CLAUDE.md → backlog voor context.

**Optie A: TestFlight via Apple Developer Program (€99/jaar)**
- Meest directe weg naar iPhone-distributie
- Vereist Apple Developer account

**Optie B: PWA blijft primaire interface**
- Geen account nodig
- Installeerbaar via Safari → "Voeg toe aan beginscherm"
- Beperking: geen push notificaties op iOS (Safari-beperking)

**Huidige keuze:** PWA blijft primaire interface. Angular-migratie staat op de backlog.
