using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Prospero.Api.Services;

namespace Prospero.Api.Tests.Helpers;

public class PushCapturingTestWebApp : TestWebApp
{
    public FakePushSender PushSender { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            // Vervang de DefaultPushSender door de fake voor tests
            var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(IPushSender));
            if (descriptor is not null) services.Remove(descriptor);
            services.AddSingleton<IPushSender>(PushSender);
        });
    }
}
