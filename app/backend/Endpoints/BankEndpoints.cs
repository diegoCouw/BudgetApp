using Microsoft.EntityFrameworkCore;
using Prospero.Api.Data;
using Prospero.Api.Services;

namespace Prospero.Api;

public static class BankEndpoints
{
    public static void MapBankEndpoints(this WebApplication app)
    {
        app.MapPost("/bank/connect", async (EnableBankingService bank, IConfiguration config, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Bank");
            var callbackUrl = config["EnableBanking:CallbackUrl"]
                ?? throw new InvalidOperationException("EnableBanking:CallbackUrl ontbreekt");
            try
            {
                log.LogInformation("Bank consent flow gestart");
                var redirectUrl = await bank.StartConsentAsync(callbackUrl);
                log.LogInformation("Bank consent redirect-URL ontvangen");
                return Results.Ok(new { url = redirectUrl });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Bank connect mislukt");
                return Results.Problem(ex.Message, statusCode: 502);
            }
        })
        .RequireAuthorization()
        .WithName("BankConnect");

        app.MapGet("/bank/callback", async (string code, EnableBankingService bank, BankSessionStore store, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Bank");
            try
            {
                var session = await bank.CreateSessionAsync(code);
                store.Save(session);
                log.LogInformation("Bank sessie aangemaakt — {AccountCount} rekening(en), geldig tot {ExpiresAt:yyyy-MM-dd}",
                    session.AccountIds.Count, session.ExpiresAt);
                return Results.Ok(new
                {
                    session_id = session.SessionId,
                    accounts = session.AccountIds.Count,
                    expires_at = session.ExpiresAt
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Bank callback mislukt voor code {Code}", code[..Math.Min(8, code.Length)]);
                return Results.Problem(ex.Message, statusCode: 502);
            }
        })
        .AllowAnonymous()
        .WithName("BankCallback");

        app.MapGet("/bank/sync", async (EnableBankingService bank, BankSessionStore store, AppDbContext db, ILoggerFactory logFactory, string? from, string? to) =>
        {
            var log = logFactory.CreateLogger("Bank");
            var session = store.Get();
            if (session is null)
            {
                log.LogWarning("Sync aangevraagd maar geen actieve bank sessie");
                return Results.Problem("Geen actieve bank sessie. Doe eerst /bank/connect.", statusCode: 401);
            }

            if (session.ExpiresAt < DateTime.UtcNow)
            {
                log.LogWarning("Sync aangevraagd maar bank sessie verlopen op {ExpiresAt:yyyy-MM-dd}", session.ExpiresAt);
                return Results.Problem("Bank sessie verlopen. Doe opnieuw /bank/connect.", statusCode: 401);
            }

            if (from is not null && !DateOnly.TryParse(from, out _))
                return Results.BadRequest(new { error = $"Ongeldig datumformaat voor 'from': {from}" });
            if (to is not null && !DateOnly.TryParse(to, out _))
                return Results.BadRequest(new { error = $"Ongeldig datumformaat voor 'to': {to}" });

            var dateFrom = from is not null ? DateOnly.Parse(from) : DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
            var dateTo = to is not null ? DateOnly.Parse(to) : DateOnly.FromDateTime(DateTime.UtcNow);

            log.LogInformation("Bank sync gestart voor {From} → {To} ({AccountCount} rekening(en))",
                dateFrom, dateTo, session.AccountIds.Count);

            int saved = 0, skipped = 0;

            try
            {
                foreach (var accountId in session.AccountIds)
                {
                    var txs = await bank.GetTransactionsAsync(session.SessionId, accountId, dateFrom, dateTo);
                    foreach (var t in txs)
                    {
                        if (await db.Transactions.AnyAsync(x => x.ExternalId == t.Id))
                        {
                            skipped++;
                            continue;
                        }
                        db.Transactions.Add(new TransactionEntity
                        {
                            ExternalId = t.Id,
                            AccountId = accountId,
                            Amount = t.Amount,
                            Currency = t.Currency,
                            Direction = t.Direction,
                            BookingDate = t.BookingDate,
                            Description = t.Description
                        });
                        saved++;
                    }
                }

                await db.SaveChangesAsync();
                log.LogInformation("Bank sync klaar — {Saved} opgeslagen, {Skipped} overgeslagen", saved, skipped);
                return Results.Ok(new { from = dateFrom.ToString("yyyy-MM-dd"), to = dateTo.ToString("yyyy-MM-dd"), saved, skipped });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Bank sync mislukt voor {From} → {To}", dateFrom, dateTo);
                return Results.Problem(ex.Message, statusCode: 502);
            }
        })
        .RequireAuthorization()
        .WithName("BankSync");

        app.MapGet("/transactions", async (AppDbContext db, ILoggerFactory logFactory, string? from, string? to, string? category) =>
        {
            var log = logFactory.CreateLogger("Bank");
            try
            {
                var query = db.Transactions.AsQueryable();

                if (from is not null)
                {
                    if (!DateOnly.TryParse(from, out var dateFrom))
                        return Results.BadRequest(new { error = $"Ongeldig datumformaat voor 'from': {from}" });
                    query = query.Where(t => t.BookingDate >= dateFrom);
                }
                if (to is not null)
                {
                    if (!DateOnly.TryParse(to, out var dateTo))
                        return Results.BadRequest(new { error = $"Ongeldig datumformaat voor 'to': {to}" });
                    query = query.Where(t => t.BookingDate <= dateTo);
                }
                if (category is not null) query = query.Where(t => t.Category == category);

                var txs = await query.OrderByDescending(t => t.BookingDate).Select(t => new
                {
                    id = t.Id,
                    external_id = t.ExternalId,
                    account_id = t.AccountId,
                    amount = t.Amount,
                    currency = t.Currency,
                    type = t.Direction == "CRDT" ? "inkomst" : "uitgave",
                    date = t.BookingDate.ToString("yyyy-MM-dd"),
                    description = t.Description,
                    category = t.Category
                }).ToListAsync();

                return Results.Ok(new { count = txs.Count, transactions = txs });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Transacties ophalen mislukt");
                return Results.Problem(ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .WithName("GetTransactions");

        app.MapPatch("/transactions/{id:int}/category", async (int id, CategoryRequest req, AppDbContext db, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Bank");
            try
            {
                var tx = await db.Transactions.FindAsync(id);
                if (tx is null)
                {
                    log.LogWarning("Categorie-update voor onbekende transactie {Id}", id);
                    return Results.NotFound();
                }
                tx.Category = req.Category;
                await db.SaveChangesAsync();
                log.LogInformation("Transactie {Id} gecategoriseerd als {Category}", id, req.Category ?? "(leeg)");
                return Results.Ok(new { id, category = tx.Category });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Categorie opslaan mislukt voor transactie {Id}", id);
                return Results.Problem(ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .WithName("SetCategory");

        app.MapDelete("/bank/session", (BankSessionStore store, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Bank");
            store.Clear();
            log.LogInformation("Bank sessie verbroken");
            return Results.Ok(new { message = "Bankverbinding verbroken" });
        })
        .RequireAuthorization()
        .WithName("BankDisconnect");
    }
}

record CategoryRequest(string? Category);
