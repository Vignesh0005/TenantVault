using System.Text.RegularExpressions;

namespace TenantVault.Tests.StaticAnalysisTests;

/// <summary>Fails the build if production code uses APIs that bypass tenant isolation.</summary>
public sealed partial class ForbiddenApiTests
{
    private static readonly string[] ForbiddenApis = ["IgnoreQueryFilters", "FromSqlRaw", "ExecuteSqlRaw", "FromSqlInterpolated", "ExecuteSqlInterpolated", "SqlQueryRaw"];

    // Paths (relative to src/, forward slashes) permitted to contain a forbidden API, with the reason. Currently none.
    private static readonly IReadOnlyDictionary<string, string> AllowList = new Dictionary<string, string>();

    [Fact]
    public void Source_does_not_use_isolation_bypassing_apis()
    {
        var violations = SourceFiles()
            .Where(f => !AllowList.ContainsKey(f.RelativePath))
            .SelectMany(f => File.ReadLines(f.FullPath).Select((line, i) => (f.RelativePath, Line: i + 1, Text: line)))
            .Where(l => ForbiddenApis.Any(api => l.Text.Contains(api, StringComparison.Ordinal)))
            .Select(l => $"{l.RelativePath}:{l.Line}: {l.Text.Trim()}")
            .ToList();

        Assert.True(violations.Count == 0, "Forbidden data-access APIs found:\n" + string.Join("\n", violations));
    }

    [Fact]
    public void Source_has_no_todo_markers()
    {
        var violations = SourceFiles()
            .SelectMany(f => File.ReadLines(f.FullPath).Select((line, i) => (f.RelativePath, Line: i + 1, Text: line)))
            .Where(l => TodoPattern().IsMatch(l.Text))
            .Select(l => $"{l.RelativePath}:{l.Line}")
            .ToList();

        Assert.True(violations.Count == 0, "TODO/FIXME markers found:\n" + string.Join("\n", violations));
    }

    [Fact]
    public void Controllers_do_not_touch_the_db_context_directly()
    {
        var violations = SourceFiles()
            .Where(f => f.RelativePath.StartsWith("TenantVault.Api/Controllers/", StringComparison.Ordinal))
            .Where(f => File.ReadAllText(f.FullPath).Contains("AppDbContext", StringComparison.Ordinal))
            .Select(f => f.RelativePath)
            .ToList();

        Assert.True(violations.Count == 0, "Controllers must go through services:\n" + string.Join("\n", violations));
    }

    private static IEnumerable<(string FullPath, string RelativePath)> SourceFiles()
    {
        var src = Path.Combine(FindBackendRoot(), "src");
        return Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories)
            .Where(p => !p.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                        && !p.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
            .Select(p => (p, Path.GetRelativePath(src, p).Replace('\\', '/')));
    }

    private static string FindBackendRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Directory.Build.props")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new DirectoryNotFoundException("Could not locate the backend root (Directory.Build.props).");
    }

    [GeneratedRegex(@"\b(TODO|FIXME)\b")]
    private static partial Regex TodoPattern();
}
