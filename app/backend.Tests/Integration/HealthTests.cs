using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class HealthTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateClient();

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var resp = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Health_ReturnsTimestamp()
    {
        var resp = await _client.GetAsync("/health");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("timestamp", out _));
    }

    [Fact]
    public async Task HealthDb_ReturnsConnected()
    {
        var resp = await _client.GetAsync("/health/db");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", json.GetProperty("status").GetString());
        Assert.True(json.GetProperty("connected").GetBoolean());
    }

    [Fact]
    public async Task HealthDb_ReturnsMigrationCounts()
    {
        var resp = await _client.GetAsync("/health/db");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("applied_migrations", out _));
        Assert.True(json.TryGetProperty("pending_migrations", out _));
    }

    [Fact]
    public async Task Health_IsPublic_NoAuthRequired()
    {
        var resp = await _client.GetAsync("/health");
        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task HealthDb_IsPublic_NoAuthRequired()
    {
        var resp = await _client.GetAsync("/health/db");
        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}
