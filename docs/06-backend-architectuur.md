# Backend — architectuur en componenten

## Overzicht

De backend is een **ASP.NET Core 11 Minimal API**, gebouwd als een Docker-container en gehost op Azure Container Apps. Ze fungeert als brug tussen de PWA en:
- **Enable Banking API** — bank-koppeling en transacties ophalen
- **Neon PostgreSQL** — transacties en sessies opslaan

---

## Locatie

```
app/backend/
```

Open in Visual Studio via `app/Prospero.slnx`.

---

## Bestandsstructuur

```
app/backend/
├── Endpoints/
│   ├── AuthEndpoints.cs        POST /auth/login
│   ├── BankEndpoints.cs        Bank-gerelateerde endpoints
│   └── HealthEndpoints.cs      GET /health
├── Services/
│   ├── TokenService.cs         JWT generatie (HS256, 60 min)
│   ├── EnableBankingService.cs Enable Banking API-wrapper
│   └── BankSessionStore.cs     Sessie-opslag in Neon DB
├── Data/
│   ├── AppDbContext.cs         EF Core DbContext
│   └── Entities.cs            TransactionEntity, BankSessionEntity
├── Models/
│   └── BankModels.cs          BankSession, BankTransaction records
├── Migrations/                EF Core migrations (auto-apply bij deploy)
├── Program.cs                 Configuratie, DI, middleware
├── appsettings.json           Basis config (geen secrets)
├── appsettings.Development.json  Dev-specifieke config
└── Dockerfile                 Multi-stage build, poort 8080
```

---

## Endpoints

| Methode | Pad | Auth | Beschrijving |
|---|---|---|---|
| `GET` | `/health` | Nee | Health check + versie |
| `POST` | `/auth/login` | Nee | Wachtwoord → JWT token (60 min) |
| `POST` | `/bank/connect` | JWT | Start bank consent flow → redirect-URL |
| `GET` | `/bank/callback` | Nee | OAuth2 code → sessie + accounts opslaan |
| `GET` | `/bank/sync` | JWT | Nieuwe transacties ophalen (params: `from`, `to`) |
| `GET` | `/transactions` | JWT | Opgeslagen transacties (filter: `from`, `to`, `category`) |
| `PATCH` | `/transactions/{id}/category` | JWT | Categorie instellen op een transactie |
| `DELETE` | `/bank/session` | JWT | Bankverbinding verbreken, sessie verwijderen |

---

## Program.cs — configuratie

```csharp
// JWT authenticatie (HS256)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { ... });

// EF Core + Neon PostgreSQL
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(connStr));

// Services
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<BankSessionStore>();
builder.Services.AddHttpClient<EnableBankingService>();

// CORS — toegestane origins
policy.WithOrigins(
    "https://diegocouw.github.io",  // PWA
    "http://localhost:4200",         // Angular dev
    "capacitor://localhost",         // Capacitor iOS
    "http://localhost"               // Capacitor Android
);

// Auto-migrate database bij opstarten
db.Database.Migrate();
```

---

## TokenService.cs

Genereert een **HS256 JWT** (60 minuten geldig):

```csharp
var token = new JwtSecurityToken(
    issuer: _issuer,
    claims: [new Claim(ClaimTypes.Name, subject)],
    expires: DateTime.UtcNow.AddMinutes(60),
    signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
);
```

---

## AuthEndpoints.cs

Vergelijkt wachtwoord als SHA-256 hash met `FixedTimeEquals` (timing-safe):

```csharp
var inputHash = SHA256.HashData(Encoding.UTF8.GetBytes(req.Password));
if (!CryptographicOperations.FixedTimeEquals(inputHash, storedHashBytes))
    return Results.Unauthorized();
```

---

## EnableBankingService.cs

Elke API-aanroep gebruikt een **RSA-signed JWT** als Bearer token:
- Ondertekend met de private key (uit Azure secret als base64)
- `kid`-header bevat de application ID
- Geldig voor 1 uur

Methoden:
| Methode | Beschrijving |
|---|---|
| `StartConsentAsync(redirectUrl)` | POST /auth → geeft bank-redirect-URL terug |
| `CreateSessionAsync(code)` | POST /sessions → wisselt code in voor sessie + accounts |
| `GetTransactionsAsync(sessionId, accountId, from, to)` | GET /accounts/{id}/transactions |

**Foutafhandeling:** bij een niet-succesvolle HTTP-status logt de service de fout en geeft een lege lijst terug (geen crash). Dit is nodig omdat de BBVA sandbox 422 geeft bij grote datumbereiken.

---

## BankSessionStore.cs

Leest van en schrijft naar de **Neon `BankSessions` tabel**. Singleton — één instantie voor de hele app.

| Methode | Beschrijving |
|---|---|
| `Get()` | Laatste sessie uit DB ophalen (of null als leeg) |
| `Save(session)` | Nieuwe sessie opslaan in DB |
| `Clear()` | Alle sessierijen verwijderen (bankverbinding verbreken) |

---

## AppDbContext.cs

EF Core DbContext met twee DbSet's:

```csharp
public DbSet<TransactionEntity> Transactions { get; set; }
public DbSet<BankSessionEntity> BankSessions { get; set; }
```

---

## Authenticatie flow

```
PWA → POST /auth/login { password: "..." }
Backend:
  1. SHA-256 hash van het ingestuurde wachtwoord
  2. Timing-safe vergelijking met opgeslagen hash (Azure secret)
  3. Bij match: genereer JWT (TokenService)
  4. Geef JWT terug

PWA slaat JWT op in localStorage['prospero_jwt']
PWA stuurt JWT mee als: Authorization: Bearer <token>
```

---

## Secrets (configuratiesleutels)

Alle secrets zijn beschikbaar via `IConfiguration` (ingesteld als Azure Container App secrets):

| Configuratiesleutel | Azure secret naam |
|---|---|
| `Jwt:Key` | `jwt-key` |
| `Auth:PasswordHash` | `auth-password-hash` |
| `ConnectionStrings:Neon` | `neon-connection-string` |
| `EnableBanking:AppId` | `enablebanking-app-id` |
| `EnableBanking:PrivateKeyBase64` | `enablebanking-private-key-base64` |
| `EnableBanking:CallbackUrl` | `enablebanking-callback-url` |
| `EnableBanking:AspspName` | `enablebanking-aspsp-name` |
| `EnableBanking:AspspCountry` | `enablebanking-aspsp-country` |

---

## Dockerfile

Multi-stage build:
1. **Build stage**: `mcr.microsoft.com/dotnet/sdk:11` — `dotnet publish`
2. **Runtime stage**: `mcr.microsoft.com/dotnet/aspnet:11` — poort 8080

HTTPS wordt afgehandeld door Azure Container Apps, niet door de container.

---

## Lokaal draaien

1. Maak `appsettings.Local.json` aan (staat in `.gitignore`):
```json
{
  "Jwt": { "Key": "lokale-sleutel-min-32-tekens-!!!" },
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

2. Starten:
```powershell
cd app/backend
dotnet run
```

Of open `app/Prospero.slnx` in Visual Studio en druk op F5.
