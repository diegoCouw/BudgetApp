using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Prospero.Api;
using Prospero.Api.Data;
using Prospero.Api.Services;
using Prospero.Api.Models;
using Serilog;
using System.Text;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateBootstrapLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, services, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"));

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
                "https://diegocouw.github.io", // PWA GitHub Pages
                "http://localhost:4200",        // Angular dev
                "capacitor://localhost",        // Capacitor iOS
                "http://localhost")             // Capacitor Android
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
    var startupLog = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        db.Database.Migrate();
        startupLog.LogInformation("Database migraties toegepast");
    }
    catch (Exception ex)
    {
        startupLog.LogCritical(ex, "Database migratie mislukt — applicatie stopt");
        throw;
    }
}

app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} → {StatusCode} ({Elapsed:0}ms)";
});

app.UseExceptionHandler(err => err.Run(async ctx =>
{
    var ex = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    var logger = ctx.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogError(ex, "Onverwerkte fout bij {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
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
