using Microsoft.EntityFrameworkCore;
using Prospero.Api.Data;

namespace Prospero.Api;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this WebApplication app)
    {
        app.MapGet("/health", (IConfiguration config) => Results.Ok(new
        {
            status = "ok",
            version = config["App:Version"],
            timestamp = DateTime.UtcNow
        }))
           .AllowAnonymous()
           .WithName("Health");

        app.MapGet("/health/db", async (AppDbContext db) =>
        {
            try
            {
                await db.Database.ExecuteSqlRawAsync("SELECT 1");
                var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
                var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();
                return Results.Ok(new
                {
                    status = "ok",
                    connected = true,
                    applied_migrations = applied.Count,
                    pending_migrations = pending.Count,
                    pending_names = pending,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return Results.Json(new
                {
                    status = "error",
                    connected = false,
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                }, statusCode: 503);
            }
        })
        .AllowAnonymous()
        .WithName("HealthDb");
    }
}
