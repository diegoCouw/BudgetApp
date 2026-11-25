using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Prospero.Api.Data;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class BankTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateAuthenticatedClient();

    private void ClearSessions()
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.BankSessions.RemoveRange(db.BankSessions);
        db.SaveChanges();
    }

    private void SeedExpiredSession()
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.BankSessions.Add(new BankSessionEntity
        {
            SessionId = "expired-session",
            AccountIdsJson = "[\"acc-1\"]",
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-91)
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task Sync_NoSession_Returns401()
    {
        ClearSessions();

        var resp = await _client.GetAsync("/bank/sync");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Sync_ExpiredSession_Returns401()
    {
        ClearSessions();
        SeedExpiredSession();

        var resp = await _client.GetAsync("/bank/sync");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Sync_WithoutAuth_Returns401()
    {
        var client = app.CreateClient();
        var resp = await client.GetAsync("/bank/sync");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Connect_WithoutAuth_Returns401()
    {
        var client = app.CreateClient();
        var resp = await client.PostAsync("/bank/connect", null);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}
