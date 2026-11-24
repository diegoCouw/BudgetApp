# Azure — setup en beheer

## Inloggen op Azure CLI

```powershell
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
az login
```

Dit opent een browser. Log in met je Microsoft-account dat toegang heeft tot `prospero-rg`.  
Daarna werken alle `az containerapp`-commando's hieronder.

---

## Wat staat er in Azure

Alle resources zitten in **resource group `prospero-rg`** (North Europe — Dublin).  
Verwijder enkel deze groep om alles in één keer op te ruimen.

### Resources

| Resource | Type | Beschrijving |
|---|---|---|
| `prospero-env` | Container Apps Environment | Beheerde infrastructuur voor containers |
| `prospero-api` | Container App | De ASP.NET Core backend |

### Secrets op `prospero-api`

| Naam | Inhoud |
|---|---|
| `jwt-key` | Signing key voor JWT tokens |
| `auth-password-hash` | SHA-256 hash van het inlogwachtwoord |
| `enablebanking-private-key` | RSA private key (base64-encoded) voor Enable Banking API |
| `enablebanking-app-id` | Application ID van de Prospero sandbox app op enablebanking.com |
| `neon-connection-string` | PostgreSQL connection string voor Neon.tech database |

Secrets zijn enkel zichtbaar via de Azure portal (niet in logs, niet in code).

> **Let op**: gebruik de **directe** Neon endpoint (zonder `-pooler`) voor de connection string. De pooler-variant blokkeert DDL-statements (CREATE TABLE) die EF Core migrations nodig heeft.

---

## Neon PostgreSQL database

Transacties en bank-sessies worden opgeslagen in [Neon.tech](https://neon.tech) (gratis forever tier).

| Instelling | Waarde |
|---|---|
| Project | `prospero` |
| Database | `neondb` |
| Branch | `production` (default) |
| Regio | EU Central (Frankfurt) |
| Endpoint | Direct (geen pooler) — vereist voor EF Core migrations |

### Connection string instellen

```powershell
az containerapp secret set `
  --name prospero-api `
  --resource-group prospero-rg `
  --secrets "neon-connection-string=Host=ENDPOINT;Database=neondb;Username=neondb_owner;Password=WACHTWOORD;SSL Mode=Require"
```

Haal de endpoint en het wachtwoord op via het Neon dashboard → **Connection Details** (pooler uitgeschakeld).

### Wachtwoord resetten

Via het Neon dashboard → **Settings** → **Reset password**. Vergeet daarna het Azure secret bij te werken.

---

## Waarom geen kosten

De app staat op `min-replicas: 0` — hij schaalt naar nul als hij niet gebruikt wordt.  
**Geen aanroepen = geen kosten.**

Azure Container Apps free tier (maandelijks):

| Limiet | Jouw gebruik (1 call/dag) | % gebruikt |
|---|---|---|
| 180.000 vCPU-seconden | ~0,09 seconden | 0,00005% |
| 360.000 GiB-seconden | verwaarloosbaar | ~0% |
| 2.000.000 requests | ~30 | 0,0015% |

Na de proefperiode (€200 / 30 dagen) blijven de gratis limieten actief.  
Azure schakelt **nooit automatisch over naar betaald** — je moet zelf upgraden.  
Budget alert staat op €1 met e-mailnotificatie.

---

## Deployment

Automatisch via GitHub Actions bij push naar `main` met wijzigingen in `app/backend/`:

```
git push origin main
       ↓
GitHub Actions (.github/workflows/deploy-backend.yml)
       ↓
Docker image gebouwd (multi-stage, .NET 11)
       ↓
Image gepusht naar ghcr.io/diegocouw/prospero-api:latest
       ↓
az containerapp update → Azure haalt nieuw image op
       ↓
Container App draait nieuwe versie (zero-downtime rolling update)
       ↓
Smoke test: GET /health → bevestigt dat de nieuwe container draait
```

---

## Cold start

Bij inactiviteit schaalt de container naar nul. De eerste aanroep na een stilteperiode duurt **~3 seconden** (cold start). Daarna is de container warm voor ~10 minuten.

Voor een dagelijkse BNP-sync is dit acceptabel — de cold start valt samen met de OAuth-redirect van de bank die sowieso even duurt.

---

## Secrets wijzigen

### Wachtwoord wijzigen

1. Genereer een nieuwe SHA-256 hash in PowerShell:
```powershell
$ww = "jouw-nieuw-wachtwoord"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($ww)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString("x2") }) -join ""
```

2. Stel de nieuwe hash in op Azure:
```powershell
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
az login
az containerapp secret set --name prospero-api --resource-group prospero-rg --secrets "auth-password-hash=NIEUWE_HASH"
```

### JWT key wijzigen

```powershell
az containerapp secret set --name prospero-api --resource-group prospero-rg --secrets "jwt-key=NIEUWE_KEY_MIN_32_TEKENS"
```

---

## GitHub Secrets

Ingesteld op de `diegoCouw/BudgetApp` repository:

| Secret | Inhoud |
|---|---|
| `AZURE_CREDENTIALS` | Service principal JSON (Contributor op `prospero-rg`) |
| `AZURE_RESOURCE_GROUP` | `prospero-rg` |
| `AZURE_CONTAINERAPP_NAME` | `prospero-api` |
| `AZURE_LOCATION` | `northeurope` |
| `BACKEND_URL` | `https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io` |

---

## Alles verwijderen

```powershell
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
az login
az group delete --name prospero-rg --yes
```

Dit verwijdert de Container App, de Environment en alle bijhorende resources in één commando.
