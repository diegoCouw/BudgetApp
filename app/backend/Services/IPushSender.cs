using Lib.Net.Http.WebPush;

namespace Prospero.Api.Services;

public interface IPushSender
{
    Task SendAsync(string endpoint, string p256dh, string auth, string payload);
}
