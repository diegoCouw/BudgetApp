# Azure Container Apps — setup en beheer

## Rol in het project

Azure Container Apps host de **ASP.NET Core backend** (Prospero API). De backend is de brug tussen de PWA (op GitHub Pages) en de bank API (Enable Banking) + database (Neon PostgreSQL).

Zonder backend werkt de bank tab niet. De PWA-functionaliteit (budgetten, categorieën, transacties) werkt volledig zonder backend via IndexedDB.

---

## Resources

Alle resources zitten in **resource group `prospero-rg`** (North Europe — Dublin).

| Resource | Type | Beschrijving |
|---|---|---|
| `prospero-env` | Container Apps Environment | Beheerde infrastructuur |
| `prospero-api` | Container App | ASP.NET Core backend, poort 8080 |

---

## Inloggen op Azure CLI

```powershell
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
az login
```

---

## Container App aanmaken (eerste keer)

```powershell
# 1. Resource group
az group create --name prospero-rg --location northeurope

# 2. Container Apps environment
az containerapp env create `
  --name prospero-env `
  --resource-group prospero-rg `
  --location northeurope

# 3. Container App (nog zonder image — wordt ingesteld door CI)
az containerapp create `
  --name prospero-api `
  --resource-group prospero-rg `
  --environment prospero-env `
  --image mcr.microsoft.com/dotnet/aspnet:11  `
  --target-port 8080 `
  --ingress external `
  --min-replicas 0 `
  --max-replicas 1
```

---

## Secrets

Secrets zijn enkel zichtbaar via de Azure portal — nooit in logs of code.

| Secret naam | Inhoud |
|---|---|
| `jwt-key` | JWT signing key (willekeurig, min. 32 tekens) |
| `auth-password-hash` | SHA-256 hex van het inlogwachtwoord |
| `enablebanking-app-id` | Enable Banking application UUID |
| `enablebanking-private-key-base64` | RSA private key als base64 |
| `enablebanking-callback-url` | OAuth2 callback URL |
| `enablebanking-aspsp-name` | Banknaam (bijv. `BBVA` of `BNP PARIBAS FORTIS`) |
| `enablebanking-aspsp-country` | Landcode (bijv. `BE`) |
| `neon-connection-string` | Npgsql key-value connection string |

### Secret instellen

```powershell
az containerapp secret set `
  --name prospero-api `
  --resource-group prospero-rg `
  --secrets "naam=waarde"
```

### Container herstarten na secret-wijziging

Secrets worden pas actief na herstart:

```powershell
$revision = az containerapp revision list `
  --name prospero-api `
  --resource-group prospero-rg `
  --query "[?properties.active].name" -o tsv
az containerapp revision restart `
  --name prospero-api `
  --resource-group prospero-rg `
  --revision $revision
```

---

## Wachtwoord wijzigen

```powershell
# 1. Genereer SHA-256 hash
$ww = "nieuw-wachtwoord"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($ww)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString("x2") }) -join ""

# 2. Instellen op Azure
az containerapp secret set `
  --name prospero-api `
  --resource-group prospero-rg `
  --secrets "auth-password-hash=HASH_HIER"

# 3. Herstarten
```

---

## Deployment pipeline

Automatisch via GitHub Actions bij push naar `main` als `app/backend/**` gewijzigd is:

```
Push naar main
  → .github/workflows/deploy-backend.yml
  → Docker multi-stage build (.NET 11)
  → Push naar ghcr.io/diegocouw/prospero-api:latest
  → az containerapp update
  → Smoke test: GET /health
```

### Manueel triggeren

```powershell
gh workflow run deploy-backend.yml --ref main
```

---

## GitHub Secrets (vereist voor CI/CD)

Stel in via GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Waarde |
|---|---|
| `AZURE_CREDENTIALS` | Service principal JSON |
| `AZURE_RESOURCE_GROUP` | `prospero-rg` |
| `AZURE_CONTAINERAPP_NAME` | `prospero-api` |
| `AZURE_LOCATION` | `northeurope` |
| `BACKEND_URL` | URL van de Container App |

**Service principal aanmaken:**
```powershell
az ad sp create-for-rbac `
  --name "prospero-github" `
  --role "Contributor" `
  --scopes "/subscriptions/SUBSCRIPTION_ID/resourceGroups/prospero-rg" `
  --sdk-auth
```

---

## Kosten

De container schaalt naar **nul** bij inactiviteit (`min-replicas: 0`) → geen gebruik = geen kosten.

| Limiet (maandelijks) | Bij dagelijks gebruik |
|---|---|
| 180.000 vCPU-seconden | ~0,09 sec → ~0% |
| 360.000 GiB-seconden | verwaarloosbaar |
| 2.000.000 requests | ~30 → ~0% |

Na proefperiode (€200 / 30 dagen) blijven gratis limieten actief. Azure schakelt **nooit automatisch** over naar betaald. Budget alert staat op €1 met e-mailnotificatie.

> **Let op voor AI-assistenten:** waarschuw de gebruiker altijd vóór acties die Azure-kosten of proefkrediet verbruiken.

---

## Cold start

Bij inactiviteit schaalt de container naar nul. Eerste aanroep na stilteperiode: **~3 seconden**. Normaal gedrag, geen probleem bij dagelijks gebruik.

---

## HTTPS

HTTPS wordt afgehandeld door Azure Container Apps, niet door de container zelf. De container luistert op HTTP poort 8080.

---

## Alles verwijderen

```powershell
az group delete --name prospero-rg --yes
```

Verwijdert alle resources in één commando.
