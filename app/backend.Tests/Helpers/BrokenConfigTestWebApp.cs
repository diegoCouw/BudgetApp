using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace Prospero.Api.Tests.Helpers;

public class BrokenConfigTestWebApp : TestWebApp
{
    private readonly string _missingKey;

    public BrokenConfigTestWebApp(string missingKey)
    {
        _missingKey = missingKey;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        // .NET config skips null values and falls back to previous providers.
        // Clear all accumulated sources and rebuild without the key to truly remove it.
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.Sources.Clear();
            var entries = new Dictionary<string, string?>
            {
                ["Jwt:Key"] = JwtKey,
                ["Jwt:Issuer"] = JwtIssuer,
                ["Jwt:ExpiresMinutes"] = "60",
                ["Auth:PasswordHash"] = TestPasswordHash,
                ["EnableBanking:AppId"] = "test-app-id",
                ["EnableBanking:PrivateKeyBase64"] = Convert.ToBase64String(Encoding.UTF8.GetBytes("placeholder")),
                ["EnableBanking:CallbackUrl"] = "http://localhost/bank/callback",
                ["EnableBanking:AspspName"] = "BBVA",
                ["EnableBanking:AspspCountry"] = "BE",
                ["ConnectionStrings:Neon"] = "Data Source=testdb;Mode=Memory;Cache=Shared",
            };
            entries.Remove(_missingKey);
            config.AddInMemoryCollection(entries);
        });
    }
}
