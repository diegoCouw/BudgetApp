using System.Text.Json;
using Prospero.Api.Models;

namespace Prospero.Api.Services;

// Bewaart de Enable Banking session op schijf zodat dagelijkse pulls werken na een cold start.
// Bij container herstart wordt de sessie herladen uit het bestand.
public class BankSessionStore
{
    private readonly string _path = "/tmp/bank-session.json";
    private BankSession? _cached;

    public BankSession? Get()
    {
        if (_cached is not null) return _cached;
        if (!File.Exists(_path)) return null;

        try
        {
            var json = File.ReadAllText(_path);
            _cached = JsonSerializer.Deserialize<BankSession>(json);
            return _cached;
        }
        catch
        {
            return null;
        }
    }

    public void Save(BankSession session)
    {
        _cached = session;
        File.WriteAllText(_path, JsonSerializer.Serialize(session));
    }
}
