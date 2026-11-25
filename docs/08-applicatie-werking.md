# End-to-end werking van de applicatie

## Architectuuroverzicht

```
iPhone (Safari / PWA)
    │
    ├── IndexedDB          ← cash-betalingen, budgetten, categorieën (lokaal)
    │
    └── HTTPS ──────────► Azure Container Apps (prospero-api)
                                │
                                ├── Neon PostgreSQL    ← bankgegevens
                                │   (EU Central)
                                │
                                └── Enable Banking API ← bank-koppeling
                                    (BBVA sandbox /
                                     BNP Fortis productie)
```

---

## Stroom 1: PWA-functies (geen backend nodig)

De meeste PWA-functies werken volledig **offline** via IndexedDB:

```
Gebruiker opent app
  → Service Worker serveert app vanuit cache (offline werkt)
  → app.js laadt IndexedDB
  → Render actieve view (home, transacties, statistieken)

Gebruiker voegt transactie toe
  → modal.js → openAdd()
  → db.js → addTx({ amount, cat, date, ym, ... })
  → IndexedDB (store: txs)
  → render() — view herlaadt

Gebruiker bekijkt statistieken
  → renderStats() leest IndexedDB
  → Berekent totalen per categorie
  → Tekent grafieken
```

---

## Stroom 2: Bank tab — eerste koppeling

```
1. Gebruiker tikt "Bank" (slotje-icoon)
   → renderBank() check: is er een JWT in localStorage?
   → Nee → renderBankLogin()

2. Gebruiker vult wachtwoord in en tikt "Inloggen"
   → doLogin() → POST https://prospero-api.../auth/login
   → Backend: SHA-256 hash vergelijking (FixedTimeEquals)
   → Succes: JWT terug (60 min geldig)
   → JWT opgeslagen in localStorage['prospero_jwt']
   → renderBankMain()

3. Gebruiker tikt "Bank koppelen"
   → doConnect() → POST /bank/connect (Bearer JWT)
   → Backend: EnableBankingService.StartConsentAsync()
     → RSA-signed JWT genereren voor Enable Banking
     → POST https://api.enablebanking.com/auth met bankgegevens
     → Enable Banking geeft redirect-URL terug
   → Backend: { url: "https://sandbox.enablebanking.com/..." }
   → PWA: window.location.href = data.url

4. Gebruiker is nu op de bank-website (bijv. BBVA sandbox)
   → Logt in en geeft toestemming

5. Bank redirect terug naar GET /bank/callback?code=...
   → Backend: EnableBankingService.CreateSessionAsync(code)
     → POST https://api.enablebanking.com/sessions
     → Krijgt session_id + lijst van rekening-UIDs terug
   → Backend: BankSessionStore.Save(session) → opgeslagen in Neon BankSessions
   → Backend: { session_id, accounts, expires_at }
   → Gebruiker ziet bevestigingspagina (of wordt teruggestuurd)
```

---

## Stroom 3: Dagelijkse sync

```
Gebruiker tikt "Synchroniseer"
  → doSync() → GET /bank/sync?from=...&to=... (Bearer JWT, 30 dagen bereik)
  → Backend: BankSessionStore.Get() → actieve sessie uit Neon DB
  → Backend: voor elke rekening in session.AccountIds:
     → EnableBankingService.GetTransactionsAsync(sessionId, accountId, from, to)
     → GET https://api.enablebanking.com/accounts/{id}/transactions?...
     → Antwoord geparst → lijst van BankTransaction records
  → Backend: voor elke transactie:
     → Check: bestaat ExternalId al in Neon Transactions?
       → Ja → skipped++
       → Nee → opslaan → saved++
  → Backend: { from, to, saved, skipped }
  → PWA: status tonen + transactielijst herladen
```

---

## Stroom 4: Transacties bekijken en categoriseren

```
Transactielijst laden
  → loadBankTxs() → GET /transactions (Bearer JWT)
  → Backend: Neon Transactions tabel ophalen, gesorteerd op datum
  → PWA: _bankTxs array bijwerken
  → renderBankCatFilter() — filter-chips tonen
  → renderBankTxList('') — lijst tonen

Categorie instellen
  → Gebruiker tikt op "categorie instellen" of bestaande badge
  → openCategoryPicker(txId, labelEl)
  → Modal met BANK_CATS emoji-chips + eigen invoerveld
  → Gebruiker kiest categorie
  → setCategory(txId, cat, labelEl)
     → PATCH /transactions/{txId}/category { category: "Boodschappen" }
     → Backend: TransactionEntity.Category bijwerken in Neon
     → PWA: badge live bijwerken (geen full reload)

Filteren
  → Tik op filter-chip → _bankCatFilter instellen
  → renderBankTxList() filtert _bankTxs in memory (geen API call)
```

---

## Stroom 5: Bankverbinding verbreken

```
Gebruiker tikt "Verbreek koppeling"
  → Knop toont "Zeker verbreken?" in rood (4 sec timeout)
  → Gebruiker tikt nogmaals
  → doDisconnect() → DELETE /bank/session (Bearer JWT)
  → Backend: BankSessionStore.Clear() → alle BankSessions rijen verwijderd uit Neon
  → Volgende sync-poging: "Geen actieve bank sessie — doe eerst /bank/connect"
  → Gebruiker moet opnieuw koppelen via "Bank koppelen"
```

---

## Service Worker & app-updates

```
App openen
  → registerSW() → sw.js geregistreerd
  → sw.js checkt cache-naam: 'budget-1.3.0'
  → Alle bestanden in ASSETS gecached

Update beschikbaar
  → Instellingen → "Controleren op updates"
  → swReg.update() → nieuwe sw.js gedownload
  → State: 'installed' → updateWaiting = true
  → Gebruiker tikt opnieuw → skipWaiting → controllerchange
  → window.location.reload() → nieuwe versie actief
```

---

## Beveiliging samengevat

| Laag | Mechanisme |
|---|---|
| PWA ↔ Backend | HTTPS + JWT Bearer token (60 min) |
| Wachtwoord | SHA-256 hash, timing-safe vergelijking |
| Bank API-credentials | Server-side only (Azure secrets), nooit in PWA |
| Database | Neon HTTPS + SSL Mode=Require |
| CORS | Whitelist van toegestane origins |
| Secrets | Uitsluitend als Azure Container App secrets |

---

## Fouten die kunnen optreden

| Fout | Oorzaak | Oplossing |
|---|---|---|
| "Verbinding mislukt" bij login | Backend is in cold start (~3 sec) of CORS-probleem | Even wachten, opnieuw proberen |
| "Geen actieve bank sessie" bij sync | Sessie verlopen (90 dagen) of verbroken | "Bank koppelen" opnieuw doen |
| Sync geeft 0 transacties | BBVA sandbox heeft geen data voor dat bereik | Test via SQL in Neon dashboard |
| "Verkeerd wachtwoord" | Foute invoer of hash niet bijgewerkt | Wachtwoord controleren |
| App toont oude versie | Service Worker cache | Instellingen → "Controleren op updates" |
