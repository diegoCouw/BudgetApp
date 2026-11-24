using Microsoft.EntityFrameworkCore;
using Prospero.Api.Data;
using Prospero.Api.Services;

namespace Prospero.Api;

public static class BankEndpoints
{
    public static void MapBankEndpoints(this WebApplication app)
    {
        app.MapPost("/bank/connect", async (EnableBankingService bank, IConfiguration config) =>
        {
            var callbackUrl = config["EnableBanking:CallbackUrl"]
                ?? throw new InvalidOperationException("EnableBanking:CallbackUrl ontbreekt");
            try
            {
                var redirectUrl = await bank.StartConsentAsync(callbackUrl);
                return Results.Ok(new { url = redirectUrl });
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message, statusCode: 502);
            }
        })
        .RequireAuthorization()
        .WithName("BankConnect");

        app.MapGet("/bank/callback", async (string code, EnableBankingService bank, BankSessionStore store) =>
        {
            var session = await bank.CreateSessionAsync(code);
            store.Save(session);
            return Results.Ok(new
            {
                session_id = session.SessionId,
                accounts = session.AccountIds.Count,
                expires_at = session.ExpiresAt
            });
        })
        .AllowAnonymous()
        .WithName("BankCallback");

        app.MapGet("/bank/sync", async (EnableBankingService bank, BankSessionStore store, AppDbContext db, string? from, string? to) =>
        {
            var session = store.Get();
            if (session is null)
                return Results.Problem("Geen actieve bank sessie. Doe eerst /bank/connect.", statusCode: 401);

            if (session.ExpiresAt < DateTime.UtcNow)
                return Results.Problem("Bank sessie verlopen. Doe opnieuw /bank/connect.", statusCode: 401);

            var dateFrom = from is not null ? DateOnly.Parse(from) : DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
            var dateTo = to is not null ? DateOnly.Parse(to) : DateOnly.FromDateTime(DateTime.UtcNow);

            int saved = 0, skipped = 0;

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

            return Results.Ok(new { from = dateFrom.ToString("yyyy-MM-dd"), to = dateTo.ToString("yyyy-MM-dd"), saved, skipped });
        })
        .RequireAuthorization()
        .WithName("BankSync");

        app.MapGet("/transactions", async (AppDbContext db, string? from, string? to, string? category) =>
        {
            var query = db.Transactions.AsQueryable();

            if (from is not null) query = query.Where(t => t.BookingDate >= DateOnly.Parse(from));
            if (to is not null) query = query.Where(t => t.BookingDate <= DateOnly.Parse(to));
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
        })
        .RequireAuthorization()
        .WithName("GetTransactions");

        app.MapPatch("/transactions/{id:int}/category", async (int id, CategoryRequest req, AppDbContext db) =>
        {
            var tx = await db.Transactions.FindAsync(id);
            if (tx is null) return Results.NotFound();
            tx.Category = req.Category;
            await db.SaveChangesAsync();
            return Results.Ok(new { id, category = tx.Category });
        })
        .RequireAuthorization()
        .WithName("SetCategory");
    }
}

record CategoryRequest(string? Category);
