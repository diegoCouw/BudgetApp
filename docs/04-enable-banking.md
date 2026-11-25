# Enable Banking — setup en configuratie

## Rol in het project

Enable Banking is de **bank API-aggregator** die de OAuth2 consent flow met de bank afhandelt en transacties ophaalt. De backend communiceert server-side met Enable Banking — credentials komen nooit in de PWA terecht.

Huidig gebruik: **BBVA sandbox** (testomgeving met fictieve transacties).  
Toekomstig: **BNP Paribas Fortis** (echte rekeningen).

---

## Hoe het werkt (OAuth2 flow)

```
1. Gebruiker tikt "Bank koppelen" in de app
   → PWA roept POST /bank/connect aan (backend)

2. Backend genereert een RSA-signed JWT (Bearer token voor Enable Banking)
   → POST https://api.enablebanking.com/auth met bankgegevens + redirect URL
   → Enable Banking geeft een redirect-URL terug naar de bank

3. PWA redirect de gebruiker naar de bank (bijv. BBVA of BNP Fortis)
   → Gebruiker logt in en geeft toestemming

4. Bank redirect terug naar GET /bank/callback?code=...
   → Backend wisselt de code in voor een session ID + rekening-UIDs
   → Sessie wordt opgeslagen in Neon DB (90 dagen geldig)

5. Gebruiker tikt "Synchroniseer"
   → Backend haalt transacties op per rekening via GET /accounts/{id}/transactions
   → Nieuwe transacties worden opgeslagen in Neon DB
```

---

## Applicatie aanmaken op enablebanking.com

### Sandbox (huidige setup)

1. Ga naar [enablebanking.com](https://enablebanking.com) → maak een account aan
2. Ga naar **Applications** → **New application**
3. Kies **Sandbox**
4. Genereer een RSA-sleutelpaar (zie hieronder)
5. Upload de **publieke sleutel** in de applicatie-instellingen
6. Noteer de **Application ID** (UUID)

### Productie (toekomstig — BNP Fortis)

1. Ga naar **Applications** → **New application**
2. Kies **Production**
3. Selecteer bank: **BNP PARIBAS FORTIS**, land: **BE**
4. Volg het verificatieproces (kan enkele dagen duren)
5. Upload de publieke sleutel
6. Update de Azure secrets (zie hieronder)

---

## RSA-sleutelpaar genereren

```powershell
# Windows — via OpenSSL (installeer via winget install OpenSSL.Light of Git Bash)
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Private key naar base64 converteren (voor Azure secret)
$pem = Get-Content -Raw private_key.pem
$bytes = [System.Text.Encoding]::UTF8.GetBytes($pem)
[Convert]::ToBase64String($bytes)
```

Upload `public_key.pem` naar Enable Banking. Sla `private_key.pem` veilig op (of verwijder het nadat je de base64-versie hebt opgeslagen als Azure secret).

---

## Azure secrets instellen

```powershell
# Application ID
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-app-id=JOUW_APP_UUID"

# Private key (base64)
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-private-key-base64=BASE64_STRING_HIER"

# Callback URL (URL van de backend + /bank/callback)
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-callback-url=https://prospero-api.agreeablecliff-581de768.northeurope.azurecontainerapps.io/bank/callback"

# Bank (sandbox)
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-aspsp-name=BBVA"
az containerapp secret set --name prospero-api --resource-group prospero-rg `
  --secrets "enablebanking-aspsp-country=BE"

# Bank (productie BNP Fortis — nog niet actief)
# az containerapp secret set ... --secrets "enablebanking-aspsp-name=BNP PARIBAS FORTIS"
```

---

## Overschakelen van sandbox naar productie

1. Maak een productie-applicatie aan op enablebanking.com (zie hierboven)
2. Genereer een nieuw RSA-sleutelpaar (of hergebruik bestaand)
3. Update deze Azure secrets:
   - `enablebanking-app-id` → nieuw productie-UUID
   - `enablebanking-private-key-base64` → productie private key
   - `enablebanking-aspsp-name` → `BNP PARIBAS FORTIS`
4. Herstart de container
5. Doe de bank-koppeling opnieuw via de app

---

## Bekende beperkingen (sandbox)

- **BBVA sandbox geeft 422** bij datumbereiken groter dan ~60 dagen. De backend logt dit en geeft een lege lijst terug (geen crash).
- **Sandbox transacties** zijn fictieve testdata. Gebruik de SQL editor in Neon om handmatig testdata in te voeren als de sandbox niets teruggeeft.
- **Sessie vervalt na 90 dagen.** Daarna moet de gebruiker opnieuw koppelen via "Bank koppelen".

---

## Backend implementatie

Zie [app/backend/Services/EnableBankingService.cs](../app/backend/Services/EnableBankingService.cs).

Elke API-aanroep naar Enable Banking gebruikt een **RSA-signed JWT** als Bearer token:
- Ondertekend met de private key
- `kid`-header bevat de application ID
- Geldig voor 1 uur
- Audience: `api.enablebanking.com`

```csharp
var token = new JwtSecurityToken(
    issuer: "enablebanking.com",
    audience: "api.enablebanking.com",
    claims: [new Claim(JwtRegisteredClaimNames.Iat, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)],
    notBefore: now.UtcDateTime,
    expires: now.UtcDateTime.AddHours(1),
    signingCredentials: creds
);
token.Header["kid"] = appId;
```
