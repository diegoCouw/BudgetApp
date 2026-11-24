using Prospero.Api.Services;
using System.Security.Cryptography;
using System.Text;

namespace Prospero.Api;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/auth/login", (LoginRequest req, IConfiguration config, TokenService tokens) =>
        {
            var storedHash = config["Auth:PasswordHash"]
                ?? throw new InvalidOperationException("Auth:PasswordHash ontbreekt");

            var inputHash = Hash(req.Password);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(inputHash),
                    Encoding.UTF8.GetBytes(storedHash)))
            {
                return Results.Unauthorized();
            }

            var token = tokens.Generate("owner");
            return Results.Ok(new { token });
        })
        .WithName("Login")
        .AllowAnonymous();
    }

    private static string Hash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public record LoginRequest(string Password);
