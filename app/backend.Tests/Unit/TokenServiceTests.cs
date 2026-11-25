using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api.Services;

namespace Prospero.Api.Tests.Unit;

public class TokenServiceTests
{
    private static TokenService CreateService(int expiresMinutes = 60)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "test-signing-key-must-be-32-chars!!",
                ["Jwt:Issuer"] = "prospero",
                ["Jwt:ExpiresMinutes"] = expiresMinutes.ToString()
            })
            .Build();
        return new TokenService(config);
    }

    [Fact]
    public void Generate_ReturnsNonEmptyToken()
    {
        var service = CreateService();
        var token = service.Generate("owner");
        Assert.NotNull(token);
        Assert.NotEmpty(token);
    }

    [Fact]
    public void Generate_TokenIsValidJwt()
    {
        var service = CreateService();
        var tokenString = service.Generate("owner");

        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("test-signing-key-must-be-32-chars!!"));

        var principal = handler.ValidateToken(tokenString, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "prospero",
            ValidateAudience = false,
            ValidateLifetime = true,
            IssuerSigningKey = key
        }, out _);

        Assert.NotNull(principal);
    }

    [Fact]
    public void Generate_TokenHasCorrectIssuer()
    {
        var service = CreateService();
        var tokenString = service.Generate("owner");

        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(tokenString);

        Assert.Equal("prospero", token.Issuer);
    }

    [Fact]
    public void Generate_TokenExpiresInFuture()
    {
        var service = CreateService(expiresMinutes: 60);
        var tokenString = service.Generate("owner");

        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(tokenString);

        Assert.True(token.ValidTo > DateTime.UtcNow);
    }

    [Fact]
    public void Generate_ShortExpiry_TokenExpiresQuickly()
    {
        var service = CreateService(expiresMinutes: 1);
        var tokenString = service.Generate("owner");

        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(tokenString);

        Assert.True(token.ValidTo < DateTime.UtcNow.AddMinutes(2));
    }
}
