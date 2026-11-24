namespace Prospero.Api.Models;

public record BankSession(string SessionId, List<string> AccountIds, DateTime ExpiresAt);

public record BankTransaction(
    string Id,
    decimal Amount,
    string Currency,
    string Direction,   // "CRDT" of "DBIT"
    DateOnly BookingDate,
    string Description
);

public record BankAccount(string Id, string Iban, string Currency);
