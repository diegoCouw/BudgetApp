using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class SecurityTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateAuthenticatedClient();
    private readonly HttpClient _unauthClient = app.CreateClient();

    [Theory]
    [InlineData("/transactions")]
    [InlineData("/bank/sync")]
    [InlineData("/bank/connect")]
    [InlineData("/bank/session")]
    public async Task ProtectedEndpoint_WithoutAuth_Returns401(string path)
    {
        var method = path is "/bank/connect" ? HttpMethod.Post : HttpMethod.Get;
        if (path is "/bank/session") method = HttpMethod.Delete;

        var resp = await _unauthClient.SendAsync(new HttpRequestMessage(method, path));

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithExpiredJwt_Returns401()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestWebApp.JwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expired = new JwtSecurityToken(
            issuer: TestWebApp.JwtIssuer,
            expires: DateTime.UtcNow.AddHours(-1),
            signingCredentials: creds);
        var token = new JwtSecurityTokenHandler().WriteToken(expired);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var resp = await client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithTamperedJwt_Returns401()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("wrong-key-32-chars-padding-here!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var tampered = new JwtSecurityToken(
            issuer: TestWebApp.JwtIssuer,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        var token = new JwtSecurityTokenHandler().WriteToken(tampered);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var resp = await client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var resp = await _unauthClient.PostAsJsonAsync("/auth/login", new { password = "verkeerd" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Login_SuccessResponse_DoesNotExposePasswordHash()
    {
        var resp = await _unauthClient.PostAsJsonAsync("/auth/login", new { password = TestWebApp.TestPassword });
        var body = await resp.Content.ReadAsStringAsync();

        Assert.DoesNotContain(TestWebApp.TestPasswordHash, body);
        Assert.DoesNotContain("hash", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ErrorResponse_DoesNotExposeStackTrace()
    {
        var resp = await _client.GetAsync("/transactions?from=invalid");
        var body = await resp.Content.ReadAsStringAsync();

        Assert.DoesNotContain("at Prospero", body);
        Assert.DoesNotContain("StackTrace", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("System.Exception", body);
    }

    [Fact]
    public async Task HealthEndpoint_IsPubliclyAccessible()
    {
        var resp = await _unauthClient.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task BankCallback_IsPubliclyAccessible_ButRequiresValidCode()
    {
        // /bank/callback is public (no JWT needed) but should fail on invalid code
        var resp = await _unauthClient.GetAsync("/bank/callback?code=invalid-code");

        // 502 = reached the endpoint and got a bank API error (not 401)
        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}
