using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api.Data;

namespace Prospero.Api.Tests.Helpers;

public class TestWebApp : WebApplicationFactory<Program>
{
    // SHA-256 van "testpassword"
    public const string TestPassword = "testpassword";
    public const string TestPasswordHash = "9f735e0df9a1ddc702bf0a1a7b83033f9f7153a00c29de82cedadc9957289b05";
    public const string JwtKey = "test-signing-key-must-be-32-chars!!";
    public const string JwtIssuer = "prospero";

    private const string TestDbConnStr = "Data Source=testdb;Mode=Memory;Cache=Shared";

    // Houd een open verbinding zodat de named in-memory SQLite database "testdb" niet verdwijnt
    private readonly SqliteConnection _keepAlive = new(TestDbConnStr);

    private static readonly Dictionary<string, string?> TestConfig = new()
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
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Open vóór de host start zodat testdb in leven blijft tot Dispose
        _keepAlive.Open();
        // "Testing" activeert de SQLite-tak in Program.cs — geen Npgsql provider conflict
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(TestConfig));
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Verwijder tabellen uit een vorige run en maak opnieuw aan voor een schone staat
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();

        return host;
    }

    protected override void Dispose(bool disposing)
    {
        _keepAlive.Close();
        base.Dispose(disposing);
    }

    public string GenerateJwt()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public HttpClient CreateAuthenticatedClient()
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", GenerateJwt());
        return client;
    }

    public static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
