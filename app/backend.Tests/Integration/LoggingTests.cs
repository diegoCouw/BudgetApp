using System.Net.Http.Json;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class LoggingTests : IClassFixture<LogCapturingTestWebApp>
{
    private readonly LogCapturingTestWebApp _app;
    private readonly HttpClient _client;

    public LoggingTests(LogCapturingTestWebApp app)
    {
        _app = app;
        _app.LogSink.Clear();
        _client = app.CreateAuthenticatedClient();
    }

    [Fact]
    public async Task SuccessfulLogin_LogsInformation()
    {
        await _client.PostAsJsonAsync("/auth/login", new { password = TestWebApp.TestPassword });

        Assert.True(_app.LogSink.HasInfo("Succesvolle login"));
    }

    [Fact]
    public async Task FailedLogin_LogsWarning()
    {
        var unauthClient = _app.CreateClient();
        await unauthClient.PostAsJsonAsync("/auth/login", new { password = "verkeerd-wachtwoord" });

        Assert.True(_app.LogSink.HasWarning("Mislukte loginpoging"));
    }

    [Fact]
    public async Task FailedLogin_DoesNotLogPassword()
    {
        const string password = "super-secret-password-123";
        var unauthClient = _app.CreateClient();
        await unauthClient.PostAsJsonAsync("/auth/login", new { password });

        Assert.False(_app.LogSink.AnyEventContainsText(password));
    }

    [Fact]
    public async Task SyncWithoutSession_LogsWarning()
    {
        await _client.GetAsync("/bank/sync");

        Assert.True(_app.LogSink.HasWarning("Sync aangevraagd maar geen actieve bank sessie"));
    }

    [Fact]
    public async Task TransactionNotFound_LogsWarning()
    {
        await _client.PatchAsJsonAsync("/transactions/99999/category", new { category = "test" });

        Assert.True(_app.LogSink.HasWarning("Categorie-update voor onbekende transactie"));
    }
}
