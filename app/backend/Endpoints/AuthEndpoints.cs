using Prospero.Api.Services;
using System.Security.Cryptography;
using System.Text;

namespace Prospero.Api;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/auth/login", (LoginRequest req, IConfiguration config, TokenService tokens, ILoggerFactory logFactory) =>
        {
            var log = logFactory.CreateLogger("Auth");
            try
            {
                var storedHash = config["Auth:PasswordHash"]
                    ?? throw new InvalidOperationException("Auth:PasswordHash ontbreekt in configuratie");

                var inputHash = Hash(req.Password);
                if (!CryptographicOperations.FixedTimeEquals(
                        Encoding.UTF8.GetBytes(inputHash),
                        Encoding.UTF8.GetBytes(storedHash)))
                {
                    log.LogWarning("Mislukte loginpoging");
                    return Results.Unauthorized();
                }

                log.LogInformation("Succesvolle login");
                var token = tokens.Generate("owner");
                return Results.Ok(new { token });
            }
            catch (InvalidOperationException ex)
            {
                log.LogError(ex, "Configuratiefout bij login");
                return Results.Problem(ex.Message, statusCode: 500);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Onverwachte fout bij login");
                return Results.Problem("Interne fout", statusCode: 500);
            }
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
