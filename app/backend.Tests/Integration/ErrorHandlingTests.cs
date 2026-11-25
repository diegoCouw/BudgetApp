using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Prospero.Api.Models;
using Prospero.Api.Services;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class ErrorHandlingTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateAuthenticatedClient();

    private void SeedActiveSession()
    {
        using var scope = app.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<BankSessionStore>();
        store.Clear();
        store.Save(new BankSession("test-session", ["acc-1"], DateTime.UtcNow.AddDays(30)));
    }

    [Fact]
    public async Task Transactions_InvalidDateFrom_Returns400()
    {
        var resp = await _client.GetAsync("/transactions?from=notadate");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("error", out var error));
        Assert.Contains("from", error.GetString());
    }

    [Fact]
    public async Task Transactions_InvalidDateTo_Returns400()
    {
        var resp = await _client.GetAsync("/transactions?to=32-13-2024");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("error", out var error));
        Assert.Contains("to", error.GetString());
    }

    [Fact]
    public async Task BankSync_InvalidDateFrom_Returns400()
    {
        SeedActiveSession();

        var resp = await _client.GetAsync("/bank/sync?from=notadate");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task BankSync_InvalidDateTo_Returns400()
    {
        SeedActiveSession();

        var resp = await _client.GetAsync("/bank/sync?to=32-13-2024");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task Login_MissingPasswordHash_Returns500()
    {
        using var brokenApp = new BrokenConfigTestWebApp("Auth:PasswordHash");
        var client = brokenApp.CreateClient();

        var resp = await client.PostAsJsonAsync("/auth/login", new { password = "test" });

        Assert.Equal(HttpStatusCode.InternalServerError, resp.StatusCode);
    }

    [Fact]
    public async Task Transactions_ValidDates_ReturnsOk()
    {
        var resp = await _client.GetAsync("/transactions?from=2024-01-01&to=2024-12-31");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task BankSync_ValidDatesWithSession_PassesDateValidation()
    {
        SeedActiveSession();

        // Sync will fail at GetTransactionsAsync (real bank API not available) but date validation passes
        // 502 means we got past date validation; 400 would mean validation failed
        var resp = await _client.GetAsync("/bank/sync?from=2024-01-01&to=2024-01-31");

        Assert.NotEqual(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
