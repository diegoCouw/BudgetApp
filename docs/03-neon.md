# Neon PostgreSQL — setup en beheer

## Rol in het project

Neon slaat alle **bankgegevens** op die de backend verwerkt:
- **Transacties** — gesyncte bankbetalingen met categorie
- **BankSessions** — Enable Banking OAuth2 sessies (90 dagen geldig)

PWA-data (budgetten, eigen categorieën, cash-betalingen) staat **lokaal** op het apparaat in IndexedDB — daar gebruikt Neon niets voor.

---

## Account en project

| Instelling | Waarde |
|---|---|
| Dashboard | [console.neon.tech](https://console.neon.tech) |
| Project | `prospero` |
| Database | `neondb` |
| Branch | `production` (default) |
| Regio | EU Central (Frankfurt) |
| Tier | Free forever — geen kosten |

---

## Eerste keer opzetten

1. Maak een gratis account aan op [neon.tech](https://neon.tech)
2. Klik **New project** → naam: `prospero`, regio: **EU Central (Frankfurt)**
3. Ga na aanmaken naar **Connection Details**
4. Zet de **Pooler-toggle op OFF** (directe endpoint vereist)
5. Kopieer de connection string

---

## Connection string

### Verplicht formaat: Npgsql key-value

```
Host=ep-broad-base-bg7bdcke.c-9.eu-central-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=WACHTWOORD;SSL Mode=Require
```

### Waarom GEEN URI-formaat?

```
# FOUT — gebruik dit NIET
postgresql://neondb_owner:PASSWORD@host/neondb?sslmode=require
```

EF Core migrations voeren DDL-statements uit (`CREATE TABLE`, `ALTER TABLE`). De Neon pooler staat dit niet toe. Bovendien: als de URI-format in een foutmelding terechtkomt, staat het wachtwoord in plaintext in de logs.

### Waarom geen pooler-endpoint?

De Neon pooler (`-pooler` in de hostname) is incompatibel met EF Core DDL. Gebruik altijd de directe endpoint (zonder `-pooler`).

---

## Connection string instellen op Azure

```powershell
az containerapp secret set `
  --name prospero-api `
  --resource-group prospero-rg `
  --secrets "neon-connection-string=Host=ENDPOINT;Database=neondb;Username=neondb_owner;Password=WW;SSL Mode=Require"
```

Vergeet niet de container te herstarten na het instellen van het secret.

---

## Database schema

### Tabel: Transactions

| Kolom | Type | Beschrijving |
|---|---|---|
| `Id` | int (PK, auto) | Interne ID |
| `ExternalId` | string | Bank-ID, gebruikt voor deduplicatie |
| `AccountId` | string | Enable Banking rekening-UID |
| `Amount` | decimal | Bedrag |
| `Currency` | string | Valuta (standaard: EUR) |
| `Direction` | string | `CRDT` = inkomst, `DBIT` = uitgave |
| `BookingDate` | DateOnly | Boekingsdatum |
| `Description` | string | Omschrijving van de bank |
| `Category` | string? | Toegewezen categorie (null = ongecategoriseerd) |
| `CreatedAt` | DateTime | Aanmakingstijdstip (UTC) |

### Tabel: BankSessions

| Kolom | Type | Beschrijving |
|---|---|---|
| `Id` | int (PK, auto) | Interne ID |
| `SessionId` | string | Enable Banking session ID |
| `AccountIdsJson` | string | JSON-array van rekening-UIDs |
| `ExpiresAt` | DateTime | Vervaldatum (90 dagen na aanmaken) |
| `CreatedAt` | DateTime | Aanmakingstijdstip (UTC) |

---

## Auto-migrate

Bij elke backend-deploy voert de backend automatisch `db.Database.Migrate()` uit (`Program.cs`). Nieuwe EF Core migrations worden zo altijd toegepast zonder handmatige stappen.

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
```

---

## Wachtwoord resetten

1. Ga naar [console.neon.tech](https://console.neon.tech) → project `prospero`
2. **Settings** → **Reset password**
3. Kopieer het nieuwe wachtwoord
4. Update het Azure secret:
```powershell
az containerapp secret set `
  --name prospero-api `
  --resource-group prospero-rg `
  --secrets "neon-connection-string=Host=ENDPOINT;Database=neondb;Username=neondb_owner;Password=NIEUW_WW;SSL Mode=Require"
```
5. Herstart de container

---

## Neon dashboard gebruiken

**Tables** — bekijk en bewerk data direct via de UI  
**SQL editor** — query's uitvoeren, handig voor debuggen:

```sql
-- Bekijk alle transacties
SELECT * FROM "Transactions" ORDER BY "BookingDate" DESC LIMIT 20;

-- Test-transactie toevoegen
INSERT INTO "Transactions" ("ExternalId","AccountId","Amount","Currency","Direction","BookingDate","Description","Category","CreatedAt")
VALUES ('test-001','test-account',42.50,'EUR','DBIT','2026-11-01','Test betaling',NULL,NOW());

-- Sessie bekijken
SELECT * FROM "BankSessions" ORDER BY "CreatedAt" DESC;
```

**Connection Details** — haal endpoint en credentials op (zet pooler op OFF)

---

## EF Core migrations aanmaken (lokale ontwikkeling)

```powershell
cd app/backend
dotnet ef migrations add NaamVanDeMigratie
dotnet ef database update  # lokaal testen
```

Bij deploy naar Azure wordt de migration automatisch toegepast.
