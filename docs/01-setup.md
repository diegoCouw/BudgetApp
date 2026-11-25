# Stap-voor-stap setup — Prospero vanaf nul

Volg deze gids om het volledige project op te zetten op een nieuw systeem.

---

## Vereisten

| Tool | Versie | Waarvoor |
|---|---|---|
| Git | Recente versie | Versiebeheer |
| Node.js + npm | ≥ 20 | PWA-tests uitvoeren |
| .NET SDK | 11 | Backend lokaal bouwen |
| Docker Desktop | Recente versie | Backend containeriseren |
| Azure CLI (`az`) | Recente versie | Azure beheren |
| GitHub CLI (`gh`) | Recente versie | PR's aanmaken vanuit terminal |

**Azure CLI op Windows:**
```powershell
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
az login  # opent browser
```

---

## 1. Repository clonen

```powershell
git clone https://github.com/diegoCouw/BudgetApp.git
cd BudgetApp
npm install  # installeert Jest voor PWA-tests
```

---

## 2. Neon PostgreSQL opzetten

Zie [03-neon.md](03-neon.md) voor de volledige gids. Kort samengevat:

1. Maak een gratis account aan op [neon.tech](https://neon.tech)
2. Maak project `prospero` aan (regio: EU Central / Frankfurt)
3. Ga naar **Connection Details**, zet de pooler **uit**
4. Kopieer de directe connection string (formaat: `Host=...;Database=...;...`)

---

## 3. Azure Container Apps opzetten

Zie [02-azure.md](02-azure.md) voor de volledige gids. Kort samengevat:

```powershell
# Resource group aanmaken
az group create --name prospero-rg --location northeurope

# Container Apps environment
az containerapp env create --name prospero-env --resource-group prospero-rg --location northeurope

# Container App aanmaken (eerste keer)
az containerapp create `
  --name prospero-api `
  --resource-group prospero-rg `
  --environment prospero-env `
  --image ghcr.io/diegocouw/prospero-api:latest `
  --target-port 8080 `
  --ingress external `
  --min-replicas 0 --max-replicas 1
```

---

## 4. Enable Banking configureren

Zie [04-enable-banking.md](04-enable-banking.md) voor de volledige gids. Kort samengevat:

1. Maak een account aan op [enablebanking.com](https://enablebanking.com)
2. Maak een applicatie aan (sandbox of productie)
3. Genereer een RSA-sleutelpaar
4. Upload de publieke sleutel naar Enable Banking
5. Bewaar de private sleutel (als base64) als Azure secret

---

## 5. Azure secrets instellen

```powershell
# JWT signing key (willekeurig, min. 32 tekens)
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "jwt-key=WILLEKEURIGE_LANGE_SLEUTEL_MIN_32_TEKENS"

# Wachtwoord hash (SHA-256 van het gewenste wachtwoord)
$ww = "jouw-wachtwoord"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($ww)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$hashStr = ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "auth-password-hash=$hashStr"

# Neon connection string (key-value formaat, NIET URI)
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "neon-connection-string=Host=ENDPOINT;Database=neondb;Username=neondb_owner;Password=WW;SSL Mode=Require"

# Enable Banking
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-app-id=JOUW_APP_UUID"
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-private-key-base64=BASE64_VAN_RSA_PRIVATE_KEY"
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-callback-url=https://JOUW_BACKEND_URL/bank/callback"
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-aspsp-name=BBVA"  # sandbox, of BNP PARIBAS FORTIS voor productie
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-aspsp-country=BE"

# Container herstarten om secrets te activeren
$revision = az containerapp revision list --name prospero-api --resource-group prospero-rg `
  --query "[?properties.active].name" -o tsv
az containerapp revision restart --name prospero-api --resource-group prospero-rg --revision $revision
```

---

## 6. GitHub Secrets instellen

Ga naar GitHub → repository `diegoCouw/BudgetApp` → Settings → Secrets and variables → Actions.

| Secret | Waarde |
|---|---|
| `AZURE_CREDENTIALS` | Service principal JSON (zie stap hieronder) |
| `AZURE_RESOURCE_GROUP` | `prospero-rg` |
| `AZURE_CONTAINERAPP_NAME` | `prospero-api` |
| `AZURE_LOCATION` | `northeurope` |
| `BACKEND_URL` | URL van de Container App (zie Azure portal) |

**Service principal aanmaken:**
```powershell
az ad sp create-for-rbac `
  --name "prospero-github" `
  --role "Contributor" `
  --scopes "/subscriptions/SUBSCRIPTION_ID/resourceGroups/prospero-rg" `
  --sdk-auth
```
Plak de volledige JSON-output als waarde van `AZURE_CREDENTIALS`.

---

## 7. PWA-tests uitvoeren

```powershell
npm test          # alle tests
npm run coverage  # met coverage-rapport
```

---

## 8. Backend lokaal bouwen (optioneel)

Open `app/Prospero.slnx` in Visual Studio. Of via dotnet CLI:

```powershell
cd app/backend
dotnet build
dotnet run  # luistert op http://localhost:5000
```

Maak lokaal een `appsettings.Local.json` aan (staat in `.gitignore`):

```json
{
  "Jwt": { "Key": "lokale-test-sleutel-min-32-tekens-lang!!" },
  "Auth": { "PasswordHash": "SHA256_HASH_HIER" },
  "ConnectionStrings": { "Neon": "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require" },
  "EnableBanking": {
    "AppId": "...",
    "PrivateKeyBase64": "...",
    "CallbackUrl": "http://localhost:5000/bank/callback",
    "AspspName": "BBVA",
    "AspspCountry": "BE"
  }
}
```

---

## 9. PWA installeren op iPhone

1. Open [https://diegocouw.github.io/BudgetApp/](https://diegocouw.github.io/BudgetApp/) in **Safari**
2. Tik op het deel-icoon (vierkantje met pijltje omhoog)
3. Kies **"Voeg toe aan beginscherm"**
4. App opent voortaan als standalone app zonder adresbalk

---

## 10. Eerste bank-koppeling

1. Open de app → tik op het slotje (Bank tab)
2. Log in met je Prospero wachtwoord
3. Tik **"Bank koppelen"**
4. Volg de redirect naar de bank (sandbox: BBVA, productie: BNP Fortis)
5. Log in bij de bank en geef toestemming
6. Je wordt teruggestuurd naar de app
7. Tik **"Synchroniseer"** om de eerste transacties op te halen
