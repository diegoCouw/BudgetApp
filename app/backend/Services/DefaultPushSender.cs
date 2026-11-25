using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;

namespace Prospero.Api.Services;

// Thin wrapper rond PushServiceClient — uitgesloten van coverage want maakt echte HTTP calls
public class DefaultPushSender(string publicKey, string privateKey, string subject) : IPushSender
{
    public async Task SendAsync(string endpoint, string p256dh, string auth, string payload)
    {
        var vapidAuth = new VapidAuthentication(publicKey, privateKey) { Subject = subject };
        var client = new PushServiceClient { DefaultAuthentication = vapidAuth };
        var subscription = new PushSubscription
        {
            Endpoint = endpoint,
            Keys = new Dictionary<string, string> { ["p256dh"] = p256dh, ["auth"] = auth }
        };
        await client.RequestPushMessageDeliveryAsync(subscription, new PushMessage(payload) { TimeToLive = 86400 });
    }
}
