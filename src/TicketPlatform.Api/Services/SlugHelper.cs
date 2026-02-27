namespace TicketPlatform.Api.Services;

public static class SlugHelper
{
    private static readonly System.Text.RegularExpressions.Regex NonAlpha =
        new(@"[^a-z0-9]+", System.Text.RegularExpressions.RegexOptions.Compiled);

    public static string Generate(string name, Guid id)
    {
        var kebab = NonAlpha.Replace(name.ToLowerInvariant(), "-").Trim('-');
        var shortId = id.ToString("N")[..8];
        return $"{kebab}-{shortId}";
    }

    public static string GenerateReferralCode(Guid userId)
    {
        // 8-char base36 code derived from userId
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyz";
        var bytes = userId.ToByteArray().Take(6).ToArray();
        return string.Concat(bytes.Select(b => chars[b % 36]));
    }
}
