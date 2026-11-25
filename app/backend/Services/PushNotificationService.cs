using Microsoft.EntityFrameworkCore;
using Prospero.Api.Data;

namespace Prospero.Api.Services;

public class PushNotificationService(
    IServiceScopeFactory scopeFactory,
    IPushSender sender,
    ILogger<PushNotificationService> log)
{
    public async Task<bool> SaveSubscriptionAsync(PushSubscribeRequest req)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (await db.PushSubscriptions.AnyAsync(s => s.Endpoint == req.Endpoint))
            return false;

        db.PushSubscriptions.Add(new PushSubscriptionEntity
        {
            Endpoint = req.Endpoint,
            P256dh = req.P256dh,
            Auth = req.Auth
        });
        await db.SaveChangesAsync();
        log.LogInformation("Push subscription opgeslagen");
        return true;
    }

    public async Task RemoveSubscriptionAsync(string endpoint)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sub = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == endpoint);
        if (sub is not null)
        {
            db.PushSubscriptions.Remove(sub);
            await db.SaveChangesAsync();
            log.LogInformation("Push subscription verwijderd");
        }
    }

    public async Task<int> SendNotificationAsync(string title, string body)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var subscriptions = await db.PushSubscriptions.ToListAsync();

        if (subscriptions.Count == 0) return 0;

        var payload = System.Text.Json.JsonSerializer.Serialize(new { title, body });
        int sent = 0;

        foreach (var sub in subscriptions)
        {
            try
            {
                await sender.SendAsync(sub.Endpoint, sub.P256dh, sub.Auth, payload);
                sent++;
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Push notificatie sturen mislukt");
                if (ex.Message.Contains("410") || ex.Message.Contains("404"))
                {
                    db.PushSubscriptions.Remove(sub);
                    await db.SaveChangesAsync();
                    log.LogInformation("Verlopen push subscription verwijderd");
                }
            }
        }

        log.LogInformation("Push notificaties verzonden: {Sent}/{Total}", sent, subscriptions.Count);
        return sent;
    }
}

public record PushSubscribeRequest(string Endpoint, string P256dh, string Auth);
public record PushUnsubscribeRequest(string Endpoint);
public record PushNotifyRequest(string Title, string Body);
