using Prospero.Api.Services;

namespace Prospero.Api;

public static class BankEndpoints
{
    public static void MapBankEndpoints(this WebApplication app)
    {
        // Start consent flow — geeft URL terug om naar te redirecten (browser-side)
        app.MapPost("/bank/connect", async (EnableBankingService bank, IConfiguration config) =>
        {
            var callbackUrl = config["EnableBanking:CallbackUrl"]
                ?? throw new InvalidOperationException("EnableBanking:CallbackUrl ontbreekt");
            var redirectUrl = await bank.StartConsentAsync(callbackUrl);
            return Results.Ok(new { url = redirectUrl });
        })
        .RequireAuthorization()
        .WithName("BankConnect");

        // OAuth2 callback — ontvangt code van bank, slaat session op
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

        // Dagelijkse sync — haalt transacties op voor alle rekeningen
        app.MapGet("/bank/sync", async (EnableBankingService bank, BankSessionStore store, string? from, string? to) =>
        {
            var session = store.Get();
            if (session is null)
                return Results.Problem("Geen actieve bank sessie. Doe eerst /bank/connect.", statusCode: 401);

            if (session.ExpiresAt < DateTime.UtcNow)
                return Results.Problem("Bank sessie verlopen. Doe opnieuw /bank/connect.", statusCode: 401);

            var dateFrom = from is not null ? DateOnly.Parse(from) : DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
            var dateTo = to is not null ? DateOnly.Parse(to) : DateOnly.FromDateTime(DateTime.UtcNow);

            var allTransactions = new List<object>();

            foreach (var accountId in session.AccountIds)
            {
                var txs = await bank.GetTransactionsAsync(session.SessionId, accountId, dateFrom, dateTo);
                allTransactions.AddRange(txs.Select(t => new
                {
                    id = t.Id,
                    account_id = accountId,
                    amount = t.Amount,
                    currency = t.Currency,
                    type = t.Direction == "CRDT" ? "inkomst" : "uitgave",
                    date = t.BookingDate.ToString("yyyy-MM-dd"),
                    description = t.Description
                }));
            }

            return Results.Ok(new
            {
                from = dateFrom.ToString("yyyy-MM-dd"),
                to = dateTo.ToString("yyyy-MM-dd"),
                count = allTransactions.Count,
                transactions = allTransactions
            });
        })
        .RequireAuthorization()
        .WithName("BankSync");
    }
}
