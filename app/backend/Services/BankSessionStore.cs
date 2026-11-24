using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Prospero.Api.Data;
using Prospero.Api.Models;

namespace Prospero.Api.Services;

public class BankSessionStore(IServiceScopeFactory scopeFactory)
{
    public BankSession? Get()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var entity = db.BankSessions.OrderByDescending(s => s.CreatedAt).FirstOrDefault();
        if (entity is null) return null;
        var accountIds = JsonSerializer.Deserialize<List<string>>(entity.AccountIdsJson) ?? [];
        return new BankSession(entity.SessionId, accountIds, entity.ExpiresAt);
    }

    public void Save(BankSession session)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.BankSessions.Add(new BankSessionEntity
        {
            SessionId = session.SessionId,
            AccountIdsJson = JsonSerializer.Serialize(session.AccountIds),
            ExpiresAt = session.ExpiresAt,
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }
}
