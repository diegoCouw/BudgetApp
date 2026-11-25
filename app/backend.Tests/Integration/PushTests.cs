using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
            endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint-unique-" + Guid.NewGuid(),
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
        var endpoint = "https://fcm.googleapis.com/fcm/send/duplicate-endpoint-" + Guid.NewGuid();
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
        var endpoint = "https://fcm.googleapis.com/fcm/send/unsubscribe-test-" + Guid.NewGuid();
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
