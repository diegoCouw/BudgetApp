using Prospero.Api.Services;

namespace Prospero.Api.Tests.Helpers;

public class FakePushSender : IPushSender
{
    private readonly List<string> _sentEndpoints = [];
    private readonly Dictionary<string, Exception> _failureMap = [];

    public IReadOnlyList<string> SentEndpoints => _sentEndpoints.AsReadOnly();
    public int SendCount => _sentEndpoints.Count;

    public void SimulateGone(string endpoint) =>
        _failureMap[endpoint] = new Exception("410 Gone — subscription expired");

    public void SimulateError(string endpoint) =>
        _failureMap[endpoint] = new Exception("500 Internal Server Error");

    public Task SendAsync(string endpoint, string p256dh, string auth, string payload)
    {
        if (_failureMap.TryGetValue(endpoint, out var ex))
            throw ex;

        _sentEndpoints.Add(endpoint);
        return Task.CompletedTask;
    }
}
