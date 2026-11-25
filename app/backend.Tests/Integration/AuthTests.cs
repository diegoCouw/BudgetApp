using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class AuthTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateClient();

    [Fact]
    public async Task Login_CorrectPassword_ReturnsJwt()
    {
        var resp = await _client.PostAsJsonAsync("/auth/login", new { password = TestWebApp.TestPassword });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var token = json.GetProperty("token").GetString();
        Assert.NotNull(token);
        Assert.NotEmpty(token);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var resp = await _client.PostAsJsonAsync("/auth/login", new { password = "verkeerd" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Login_EmptyPassword_Returns401()
    {
        var resp = await _client.PostAsJsonAsync("/auth/login", new { password = "" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var resp = await _client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithValidToken_Returns200()
    {
        var client = app.CreateAuthenticatedClient();
        var resp = await client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }
}
