using Microsoft.EntityFrameworkCore;

namespace Prospero.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TransactionEntity> Transactions => Set<TransactionEntity>();
    public DbSet<BankSessionEntity> BankSessions => Set<BankSessionEntity>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<TransactionEntity>(e =>
        {
            e.HasKey(t => t.Id);
            e.HasIndex(t => t.ExternalId).IsUnique();
            e.Property(t => t.Amount).HasColumnType("numeric(18,2)");
        });

        model.Entity<BankSessionEntity>(e =>
        {
            e.HasKey(s => s.Id);
        });
    }
}
