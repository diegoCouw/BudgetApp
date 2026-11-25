using Serilog.Core;
using Serilog.Events;

namespace Prospero.Api.Tests.Helpers;

public class TestLogSink : ILogEventSink
{
    private readonly List<LogEvent> _events = [];

    public IReadOnlyList<LogEvent> Events => _events.AsReadOnly();

    public void Emit(LogEvent logEvent) => _events.Add(logEvent);

    public void Clear() => _events.Clear();

    public bool HasLevel(LogEventLevel level, string messageFragment) =>
        _events.Any(e => e.Level == level &&
                         e.MessageTemplate.Text.Contains(messageFragment));

    public bool HasWarning(string fragment) => HasLevel(LogEventLevel.Warning, fragment);
    public bool HasError(string fragment) => HasLevel(LogEventLevel.Error, fragment);
    public bool HasInfo(string fragment) => HasLevel(LogEventLevel.Information, fragment);

    public bool AnyEventContainsText(string text) =>
        _events.Any(e => e.RenderMessage().Contains(text, StringComparison.OrdinalIgnoreCase));
}
