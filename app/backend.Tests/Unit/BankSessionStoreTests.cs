using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Prospero.Api.Data;
using Prospero.Api.Models;
using Prospero.Api.Services;

namespace Prospero.Api.Tests.Unit;

public class BankSessionStoreTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly IServiceScopeFactory _scopeFactory;

    public BankSessionStoreTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(opt => opt.UseSqlite(_connection));
        var provider = services.BuildServiceProvider();

        using var scope = provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();

        _scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();
    }

    private BankSessionStore CreateStore() => new(_scopeFactory);

    [Fact]
    public void Get_NoSession_ReturnsNull()
    {
        var store = CreateStore();
        Assert.Null(store.Get());
    }

    [Fact]
    public void Save_ThenGet_ReturnsSavedSession()
    {
        var store = CreateStore();
        var session = new BankSession("session-123", ["acc-1", "acc-2"], DateTime.UtcNow.AddDays(89));

        store.Save(session);
        var result = store.Get();

        Assert.NotNull(result);
        Assert.Equal("session-123", result.SessionId);
        Assert.Equal(2, result.AccountIds.Count);
        Assert.Contains("acc-1", result.AccountIds);
        Assert.Contains("acc-2", result.AccountIds);
    }

    [Fact]
    public void Save_MultipleSessionss_GetReturnsNewest()
    {
        var store = CreateStore();
        var older = new BankSession("old-session", ["acc-1"], DateTime.UtcNow.AddDays(10));
        var newer = new BankSession("new-session", ["acc-2"], DateTime.UtcNow.AddDays(89));

        store.Save(older);
        store.Save(newer);
        var result = store.Get();

        Assert.Equal("new-session", result!.SessionId);
    }

    [Fact]
    public void Get_ExpiredSession_StillReturnsIt()
    {
        // Store geeft terug zonder geldigheidscontrole — endpoint controleert dit
        var store = CreateStore();
        var expired = new BankSession("expired", ["acc-1"], DateTime.UtcNow.AddDays(-1));

        store.Save(expired);
        var result = store.Get();

        Assert.NotNull(result);
        Assert.True(result.ExpiresAt < DateTime.UtcNow);
    }

    [Fact]
    public void Save_SessionWithExpiryPreserved()
    {
        var store = CreateStore();
        var expiry = DateTime.UtcNow.AddDays(89).ToUniversalTime();
        var session = new BankSession("sess", ["acc-1"], expiry);

        store.Save(session);
        var result = store.Get();

        Assert.Equal(expiry.Date, result!.ExpiresAt.ToUniversalTime().Date);
    }

    public void Dispose()
    {
        _connection.Close();
        _connection.Dispose();
    }
}
