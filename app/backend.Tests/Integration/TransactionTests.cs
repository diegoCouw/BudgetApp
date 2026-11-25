using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Prospero.Api.Data;
using Prospero.Api.Tests.Helpers;

namespace Prospero.Api.Tests.Integration;

[Collection("Integration")]
public class TransactionTests(TestWebApp app) : IClassFixture<TestWebApp>
{
    private readonly HttpClient _client = app.CreateAuthenticatedClient();

    private TransactionEntity SeedTransaction(string externalId = "ext-1", string category = "eten",
        decimal amount = 10m, string direction = "DBIT", DateOnly? date = null)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var tx = new TransactionEntity
        {
            ExternalId = externalId,
            AccountId = "acc-1",
            Amount = amount,
            Currency = "EUR",
            Direction = direction,
            BookingDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Description = "Test betaling",
            Category = category,
            CreatedAt = DateTime.UtcNow
        };
        db.Transactions.Add(tx);
        db.SaveChanges();
        return tx;
    }

    private void ClearTransactions()
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Transactions.RemoveRange(db.Transactions);
        db.SaveChanges();
    }

    [Fact]
    public async Task GetTransactions_Empty_ReturnsEmptyList()
    {
        ClearTransactions();

        var resp = await _client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("count").GetInt32());
        Assert.Equal(0, json.GetProperty("transactions").GetArrayLength());
    }

    [Fact]
    public async Task GetTransactions_WithSeededData_ReturnsList()
    {
        ClearTransactions();
        SeedTransaction("ext-get-1");

        var resp = await _client.GetAsync("/transactions");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, json.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task GetTransactions_FilterByCategory_ReturnsFiltered()
    {
        ClearTransactions();
        SeedTransaction("ext-cat-1", category: "eten");
        SeedTransaction("ext-cat-2", category: "transport");

        var resp = await _client.GetAsync("/transactions?category=eten");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, json.GetProperty("count").GetInt32());
        var tx = json.GetProperty("transactions")[0];
        Assert.Equal("eten", tx.GetProperty("category").GetString());
    }

    [Fact]
    public async Task GetTransactions_FilterByDateRange_ReturnsFiltered()
    {
        ClearTransactions();
        SeedTransaction("ext-date-1", date: new DateOnly(2024, 1, 15));
        SeedTransaction("ext-date-2", date: new DateOnly(2024, 3, 10));

        var resp = await _client.GetAsync("/transactions?from=2024-01-01&to=2024-02-01");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, json.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task GetTransactions_DirectionMappedCorrectly()
    {
        ClearTransactions();
        SeedTransaction("ext-dir-1", direction: "DBIT");
        SeedTransaction("ext-dir-2", direction: "CRDT");

        var resp = await _client.GetAsync("/transactions");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var txs = json.GetProperty("transactions").EnumerateArray().ToList();
        Assert.Contains(txs, t => t.GetProperty("type").GetString() == "uitgave");
        Assert.Contains(txs, t => t.GetProperty("type").GetString() == "inkomst");
    }

    [Fact]
    public async Task SetCategory_ExistingTransaction_UpdatesCategory()
    {
        ClearTransactions();
        var tx = SeedTransaction("ext-setcat-1", category: null!);

        var resp = await _client.PatchAsJsonAsync($"/transactions/{tx.Id}/category", new { category = "sport" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("sport", json.GetProperty("category").GetString());
    }

    [Fact]
    public async Task SetCategory_ClearCategory_SetsNull()
    {
        ClearTransactions();
        var tx = SeedTransaction("ext-clear-1", category: "eten");

        var resp = await _client.PatchAsJsonAsync($"/transactions/{tx.Id}/category", new { category = (string?)null });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task SetCategory_UnknownId_Returns404()
    {
        var resp = await _client.PatchAsJsonAsync("/transactions/999999/category", new { category = "sport" });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }
}
