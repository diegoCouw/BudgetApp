using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class ConfigurationTests
{
    // Note: testing that a missing Jwt:Key throws on startup is not possible via WebApplicationFactory
    // because Program.cs reads builder.Configuration["Jwt:Key"] during CreateBuilder() — before
    // ConfigureAppConfiguration hooks take effect. The startup guard is covered by integration smoke tests.

    [Fact]
    public async Task ValidConfig_HealthReturnsOk()
    {
        using var app = new TestWebApp();
        var client = app.CreateClient();

        var resp = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task ValidJwt_ProtectedEndpointReturnsOk()
    {
        using var app = new TestWebApp();
        var client = app.CreateAuthenticatedClient();

        var resp = await client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task JwtKeyFromConfig_IsUsedForValidation()
    {
        // A token signed with the WRONG key must be rejected — proves the configured key is active
        using var app = new TestWebApp();
        var wrongKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("wrong-key-32-chars-padding-here!!"));
        var creds = new SigningCredentials(wrongKey, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer: TestWebApp.JwtIssuer,
            expires: DateTime.UtcNow.AddHours(1), signingCredentials: creds);
        var tokenStr = new JwtSecurityTokenHandler().WriteToken(token);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenStr);

        var resp = await client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task MissingPasswordHash_LoginReturns500()
    {
        using var app = new BrokenConfigTestWebApp("Auth:PasswordHash");
        var client = app.CreateClient();

        var resp = await client.PostAsJsonAsync("/auth/login", new { password = "test" });

        Assert.Equal(HttpStatusCode.InternalServerError, resp.StatusCode);
    }

    [Fact]
    public async Task TestEnvironment_UsesSqlite_DbHealthReturnsOk()
    {
        // Proves the Testing environment correctly switches to SQLite instead of Npgsql
        using var app = new TestWebApp();
        var client = app.CreateClient();

        var resp = await client.GetAsync("/health/db");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }
}
