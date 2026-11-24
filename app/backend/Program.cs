using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api;
using Prospero.Api.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── JWT configuratie ──────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key ontbreekt in configuratie");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "prospero";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = false,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtIssuer,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });

builder.Services.AddAuthorization();

// ── Services ──────────────────────────────────────────────────────────────
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpClient(); // voor bank API calls later

// ── CORS (Angular dev server) ─────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",   // Angular dev
                "capacitor://localhost",   // Capacitor iOS
                "http://localhost")        // Capacitor Android
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// HTTPS wordt afgehandeld door Azure Container Apps — niet door de container zelf
// app.UseHttpsRedirection();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// ── Endpoints registreren ─────────────────────────────────────────────────
app.MapAuthEndpoints();
app.MapHealthEndpoints();

app.Run();
