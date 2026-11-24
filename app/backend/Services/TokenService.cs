using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Prospero.Api.Services;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public string Generate(string userId)
    {
        var key     = _config["Jwt:Key"]!;
        var issuer  = _config["Jwt:Issuer"] ?? "prospero";
        var expires = int.Parse(_config["Jwt:ExpiresMinutes"] ?? "60");

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:             issuer,
            claims:             [new Claim(ClaimTypes.NameIdentifier, userId)],
            expires:            DateTime.UtcNow.AddMinutes(expires),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
