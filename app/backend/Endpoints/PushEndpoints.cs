using Microsoft.AspNetCore.Mvc;
using Prospero.Api.Services;

namespace Prospero.Api;

public static class PushEndpoints
{
    public static void MapPushEndpoints(this WebApplication app)
    {
        app.MapPost("/push/subscribe", async (PushSubscribeRequest req, PushNotificationService push, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Push");
            try
            {
                var isNew = await push.SaveSubscriptionAsync(req);
                return Results.Ok(new { subscribed = true, isNew });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Push subscription opslaan mislukt");
                return Results.Problem(ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .WithName("PushSubscribe");

        app.MapDelete("/push/subscribe", async ([FromBody] PushUnsubscribeRequest req, PushNotificationService push, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Push");
            try
            {
                await push.RemoveSubscriptionAsync(req.Endpoint);
                return Results.Ok(new { unsubscribed = true });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Push subscription verwijderen mislukt");
                return Results.Problem(ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .WithName("PushUnsubscribe");

        app.MapPost("/push/notify", async (PushNotifyRequest req, PushNotificationService push, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Push");
            try
            {
                var sent = await push.SendNotificationAsync(req.Title, req.Body);
                return Results.Ok(new { sent });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Push notificatie sturen mislukt");
                return Results.Problem(ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .WithName("PushNotify");
    }
}
