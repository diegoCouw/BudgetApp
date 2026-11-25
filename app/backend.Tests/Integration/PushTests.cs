using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Prospero.Api.Data;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class PushTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateAuthenticatedClient();
    private readonly HttpClient _anonClient = app.CreateClient();

    [Fact]
    public async Task Subscribe_WithValidRequest_Returns200()
    {
        var resp = await _client.PostAsJsonAsync("/push/subscribe", new
        {
            endpoint = "https://fcm.googleapis.com/fcm/send/test-unique-" + Guid.NewGuid(),
            p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtZ5MuESbGgUmT72wTz",
            auth = "tBHItJI5svbpez7KI4CCXg"
        });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("subscribed").GetBoolean());
        Assert.True(body.GetProperty("isNew").GetBoolean());
    }

    [Fact]
    public async Task Subscribe_SameEndpointTwice_SecondReturnsIsNewFalse()
    {
        var endpoint = "https://fcm.googleapis.com/fcm/send/duplicate-" + Guid.NewGuid();
        var payload = new { endpoint, p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtZ5MuESbGgUmT72wTz", auth = "tBHItJI5svbpez7KI4CCXg" };

        await _client.PostAsJsonAsync("/push/subscribe", payload);
        var resp2 = await _client.PostAsJsonAsync("/push/subscribe", payload);

        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        var body = await resp2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("isNew").GetBoolean());
    }

    [Fact]
    public async Task Subscribe_WithoutAuth_Returns401()
    {
        var resp = await _anonClient.PostAsJsonAsync("/push/subscribe", new
        {
            endpoint = "https://test.example.com/push",
            p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtZ5MuESbGgUmT72wTz",
            auth = "tBHItJI5svbpez7KI4CCXg"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_ExistingEndpoint_Returns200()
    {
        var endpoint = "https://fcm.googleapis.com/fcm/send/unsubscribe-" + Guid.NewGuid();
        await _client.PostAsJsonAsync("/push/subscribe", new { endpoint, p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtZ5MuESbGgUmT72wTz", auth = "tBHItJI5svbpez7KI4CCXg" });

        var req = new HttpRequestMessage(HttpMethod.Delete, "/push/subscribe")
        {
            Content = JsonContent.Create(new { endpoint })
        };
        var resp = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("unsubscribed").GetBoolean());
    }

    [Fact]
    public async Task Unsubscribe_NonExistingEndpoint_Returns200()
    {
        var req = new HttpRequestMessage(HttpMethod.Delete, "/push/subscribe")
        {
            Content = JsonContent.Create(new { endpoint = "https://nonexistent.example.com/push" })
        };
        var resp = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_WithoutAuth_Returns401()
    {
        var resp = await _anonClient.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/push/subscribe")
        {
            Content = JsonContent.Create(new { endpoint = "https://test.example.com/push" })
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Notify_WithNoVapidKeys_ReturnsSentZero()
    {
        var resp = await _client.PostAsJsonAsync("/push/notify", new
        {
            title = "Test",
            body = "Test notificatie"
        });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("sent").GetInt32());
    }

    [Fact]
    public async Task Notify_WithoutAuth_Returns401()
    {
        var resp = await _anonClient.PostAsJsonAsync("/push/notify", new { title = "Test", body = "Test" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}

[Collection("Integration")]
public class PushSendingTests(PushCapturingTestWebApp app) : IClassFixture<PushCapturingTestWebApp>, IAsyncLifetime
{
    private readonly HttpClient _client = app.CreateAuthenticatedClient();

    // Verwijder alle push subscriptions voor elke test zodat counts kloppen
    public async Task InitializeAsync()
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.PushSubscriptions.RemoveRange(db.PushSubscriptions.ToList());
        await db.SaveChangesAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task SeedSubscription(string endpoint)
    {
        await _client.PostAsJsonAsync("/push/subscribe", new
        {
            endpoint,
            p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtZ5MuESbGgUmT72wTz",
            auth = "tBHItJI5svbpez7KI4CCXg"
        });
    }

    [Fact]
    public async Task Notify_WithSubscription_CallsFakeSender()
    {
        var endpoint = "https://fcm.googleapis.com/send/notify-test-" + Guid.NewGuid();
        await SeedSubscription(endpoint);

        var resp = await _client.PostAsJsonAsync("/push/notify", new { title = "Prospero", body = "1 nieuwe transactie" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("sent").GetInt32() >= 1);
        Assert.Contains(endpoint, app.PushSender.SentEndpoints);
    }

    [Fact]
    public async Task Notify_WhenSenderReturns410_RemovesSubscription()
    {
        var endpoint = "https://fcm.googleapis.com/send/gone-test-" + Guid.NewGuid();
        await SeedSubscription(endpoint);
        app.PushSender.SimulateGone(endpoint);

        var resp = await _client.PostAsJsonAsync("/push/notify", new { title = "Test", body = "Test" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("sent").GetInt32());

        // Verify subscription was removed
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(db.PushSubscriptions.Any(s => s.Endpoint == endpoint));
    }

    [Fact]
    public async Task Notify_WhenSenderFails_OtherSubscriptionsStillSent()
    {
        var goodEndpoint = "https://fcm.googleapis.com/send/good-" + Guid.NewGuid();
        var badEndpoint  = "https://fcm.googleapis.com/send/bad-"  + Guid.NewGuid();
        await SeedSubscription(goodEndpoint);
        await SeedSubscription(badEndpoint);
        app.PushSender.SimulateError(badEndpoint);

        var resp = await _client.PostAsJsonAsync("/push/notify", new { title = "Test", body = "Test" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, json.GetProperty("sent").GetInt32());
        Assert.Contains(goodEndpoint, app.PushSender.SentEndpoints);
    }

    [Fact]
    public async Task Notify_WithNoSubscriptions_ReturnsSentZero()
    {
        // Leeg alle subscriptions voor deze test
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.PushSubscriptions.RemoveRange(db.PushSubscriptions.ToList());
        await db.SaveChangesAsync();

        var resp = await _client.PostAsJsonAsync("/push/notify", new { title = "Test", body = "Test" });

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("sent").GetInt32());
    }
}
