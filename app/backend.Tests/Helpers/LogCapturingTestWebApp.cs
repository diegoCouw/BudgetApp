using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;

namespace Prospero.Api.Tests.Helpers;

public class LogCapturingTestWebApp : TestWebApp
{
    public TestLogSink LogSink { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        // Program.cs calls builder.Host.UseSerilog(..., cfg => cfg.ReadFrom.Services(services)...)
        // ReadFrom.Services picks up ILogEventSink registrations from DI
        builder.ConfigureServices(services =>
        {
            services.AddSingleton<ILogEventSink>(LogSink);
        });
    }
}
