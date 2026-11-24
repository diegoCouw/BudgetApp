using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api;
using Prospero.Api.Data;
using Prospero.Api.Services;
using Prospero.Api.Models;
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

// ── Database ──────────────────────────────────────────────────────────────
var connStr = builder.Configuration.GetConnectionString("Neon")
    ?? throw new InvalidOperationException("ConnectionStrings:Neon ontbreekt in configuratie");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(connStr));

// ── Services ──────────────────────────────────────────────────────────────
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<BankSessionStore>();
builder.Services.AddHttpClient<EnableBankingService>();

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

// Auto-migreer database bij opstarten
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        db.Database.Migrate();
        Console.WriteLine("[DB] Migrations succesvol uitgevoerd.");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[DB] Migration mislukt: {ex.Message}");
        Console.Error.WriteLine($"[DB] Inner: {ex.InnerException?.Message}");
        // App blijft draaien — endpoints beschikbaar, DB-calls geven 500
    }
}

app.UseExceptionHandler(err => err.Run(async ctx =>
{
    var ex = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsJsonAsync(new { error = ex?.Message ?? "Onbekende fout" });
}));

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// ── Endpoints registreren ─────────────────────────────────────────────────
app.MapAuthEndpoints();
app.MapHealthEndpoints();
app.MapBankEndpoints();

app.Run();
