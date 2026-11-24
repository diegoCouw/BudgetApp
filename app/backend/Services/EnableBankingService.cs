using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api.Models;

namespace Prospero.Api.Services;

public class EnableBankingService(IConfiguration config, HttpClient http)
{
    private const string BaseUrl = "https://api.enablebanking.com";

    private string CreateBearer()
    {
        var appId = config["EnableBanking:AppId"]
            ?? throw new InvalidOperationException("EnableBanking:AppId ontbreekt");
        var keyBase64 = config["EnableBanking:PrivateKeyBase64"]
            ?? throw new InvalidOperationException("EnableBanking:PrivateKeyBase64 ontbreekt");

        var pem = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(keyBase64));

        using var rsa = RSA.Create();
        rsa.ImportFromPem(pem);

        var key = new RsaSecurityKey(rsa.ExportParameters(true));
        var creds = new SigningCredentials(key, SecurityAlgorithms.RsaSha256)
        {
            CryptoProviderFactory = new CryptoProviderFactory { CacheSignatureProviders = false }
        };

        var now = DateTimeOffset.UtcNow;
        var handler = new JwtSecurityTokenHandler();
        var token = new JwtSecurityToken(
            issuer: "enablebanking.com",
            audience: BaseUrl.Replace("https://", ""),
            claims: [new Claim(JwtRegisteredClaimNames.Iat, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)],
            notBefore: now.UtcDateTime,
            expires: now.UtcDateTime.AddHours(1),
            signingCredentials: creds
        );
        token.Header["kid"] = appId;

        return handler.WriteToken(token);
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path, object? body = null)
    {
        var req = new HttpRequestMessage(method, $"{BaseUrl}{path}");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", CreateBearer());
        if (body is not null)
            req.Content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");
        return req;
    }

    // Stap 1: start consent flow — geeft redirect-URL naar de bank terug
    public async Task<string> StartConsentAsync(string redirectUrl)
    {
        var validUntil = DateTime.UtcNow.AddDays(89).ToString("yyyy-MM-ddTHH:mm:ssZ");
        var body = new
        {
            access = new { valid_until = validUntil },
            aspsp = new { name = "BNP Paribas Fortis", country = "BE" },
            state = Guid.NewGuid().ToString(),
            redirect_url = redirectUrl,
            psu_type = "personal"
        };

        var resp = await http.SendAsync(BuildRequest(HttpMethod.Post, "/auth", body));
        var responseBody = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Enable Banking /auth fout {(int)resp.StatusCode}: {responseBody}");

        var json = JsonNode.Parse(responseBody);
        return json!["url"]!.GetValue<string>();
    }

    // Stap 2: wissel OAuth2 code in voor session + accounts
    public async Task<BankSession> CreateSessionAsync(string code)
    {
        var resp = await http.SendAsync(BuildRequest(HttpMethod.Post, "/sessions", new { code }));
        resp.EnsureSuccessStatusCode();

        var json = JsonNode.Parse(await resp.Content.ReadAsStringAsync())!;
        var sessionId = json["session_id"]!.GetValue<string>();

        var accountIds = json["accounts"]!
            .AsArray()
            .Select(a => a!["uid"]!.GetValue<string>())
            .ToList();

        return new BankSession(sessionId, accountIds, DateTime.UtcNow.AddDays(89));
    }

    // Debug: haal ASPSP-lijst op voor een land
    public async Task<string> GetAspspsRawAsync(string country)
    {
        var resp = await http.SendAsync(BuildRequest(HttpMethod.Get, $"/aspsps?country={country}"));
        return await resp.Content.ReadAsStringAsync();
    }

    // Dagelijkse pull: haal transacties op voor één rekening
    public async Task<List<BankTransaction>> GetTransactionsAsync(string sessionId, string accountId, DateOnly from, DateOnly to)
    {
        var path = $"/accounts/{accountId}/transactions?date_from={from:yyyy-MM-dd}&date_to={to:yyyy-MM-dd}&session_id={sessionId}";
        var resp = await http.SendAsync(BuildRequest(HttpMethod.Get, path));
        resp.EnsureSuccessStatusCode();

        var json = JsonNode.Parse(await resp.Content.ReadAsStringAsync())!;
        var txs = new List<BankTransaction>();

        foreach (var t in json["transactions"]?.AsArray() ?? [])
        {
            if (t is null) continue;
            var amount = t["transaction_amount"]?["amount"]?.GetValue<decimal>() ?? 0;
            var currency = t["transaction_amount"]?["currency"]?.GetValue<string>() ?? "EUR";
            var direction = t["credit_debit_indicator"]?.GetValue<string>() ?? "DBIT";
            var date = t["booking_date"]?.GetValue<string>() ?? to.ToString("yyyy-MM-dd");
            var desc = t["remittance_information"]?.AsArray().FirstOrDefault()?.GetValue<string>() ?? "";
            var id = t["transaction_id"]?.GetValue<string>() ?? Guid.NewGuid().ToString();

            txs.Add(new BankTransaction(id, amount, currency, direction, DateOnly.Parse(date), desc));
        }

        return txs;
    }
}
