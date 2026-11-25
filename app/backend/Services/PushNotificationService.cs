using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;
using Prospero.Api.Data;

namespace Prospero.Api.Services;

public class PushNotificationService(IConfiguration config, IServiceScopeFactory scopeFactory, ILogger<PushNotificationService> log)
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
        var privateKey = config["Vapid:PrivateKey"];
        var publicKey = config["Vapid:PublicKey"];
        var subject = config["Vapid:Subject"] ?? "https://diegocouw.github.io/BudgetApp/";

        if (string.IsNullOrEmpty(privateKey) || string.IsNullOrEmpty(publicKey))
        {
            log.LogWarning("VAPID keys niet geconfigureerd — push notificatie overgeslagen");
            return 0;
        }

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var subscriptions = await db.PushSubscriptions.ToListAsync();

        if (subscriptions.Count == 0) return 0;

        var vapidAuthentication = new VapidAuthentication(publicKey, privateKey) { Subject = subject };
        var pushClient = new PushServiceClient { DefaultAuthentication = vapidAuthentication };

        var payload = System.Text.Json.JsonSerializer.Serialize(new { title, body });
        int sent = 0;

        foreach (var sub in subscriptions)
        {
            try
            {
                var subscription = new PushSubscription
                {
                    Endpoint = sub.Endpoint,
                    Keys = new Dictionary<string, string>
                    {
                        ["p256dh"] = sub.P256dh,
                        ["auth"] = sub.Auth
                    }
                };
                await pushClient.RequestPushMessageDeliveryAsync(subscription, new PushMessage(payload)
                {
                    TimeToLive = 86400
                });
                sent++;
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Push notificatie sturen mislukt");
                // 410 Gone of 404 = verlopen subscription verwijderen
                if (ex.Message.Contains("410") || ex.Message.Contains("404") ||
                    (ex is PushServiceClientException pex && ((int)pex.StatusCode == 410 || (int)pex.StatusCode == 404)))
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
