namespace Prospero.Api.Data;

public class TransactionEntity
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = "";
    public string AccountId { get; set; } = "";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Direction { get; set; } = "DBIT";
    public DateOnly BookingDate { get; set; }
    public string Description { get; set; } = "";
    public string? Category { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class BankSessionEntity
{
    public int Id { get; set; }
    public string SessionId { get; set; } = "";
    public string AccountIdsJson { get; set; } = "[]";
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PushSubscriptionEntity
{
    public int Id { get; set; }
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
