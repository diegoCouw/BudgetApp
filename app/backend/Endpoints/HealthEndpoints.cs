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
    }
}
