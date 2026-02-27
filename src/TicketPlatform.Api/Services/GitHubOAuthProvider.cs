using System.Net.Http.Headers;
using System.Text.Json;

namespace TicketPlatform.Api.Services;

public class GitHubOAuthProvider(IConfiguration config, IHttpClientFactory http) : IOAuthProvider
{
    public string ProviderName => "GitHub";

    public string BuildAuthorizationUrl(string redirectUri, string state, string codeChallenge) =>
        // GitHub does not support PKCE; state is the CSRF protection
        "https://github.com/login/oauth/authorize?" + string.Join("&", new Dictionary<string, string>
        {
            ["client_id"] = config["OAuth:GitHub:ClientId"]!,
            ["redirect_uri"] = redirectUri,
            ["scope"] = "read:user user:email",
            ["state"] = state,
        }.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

    public async Task<OAuthUserInfo> GetUserInfoAsync(string code, string redirectUri, string codeVerifier)
    {
        using var client = http.CreateClient();
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var tokenRes = await client.PostAsync("https://github.com/login/oauth/access_token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = config["OAuth:GitHub:ClientId"]!,
                ["client_secret"] = config["OAuth:GitHub:ClientSecret"]!,
                ["redirect_uri"] = redirectUri,
            }));
        tokenRes.EnsureSuccessStatusCode();

        var tokenDoc = JsonDocument.Parse(await tokenRes.Content.ReadAsStringAsync());
        var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString()!;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("AustinTickets/1.0");

        var userRes = await client.GetAsync("https://api.github.com/user");
        userRes.EnsureSuccessStatusCode();
        var user = JsonDocument.Parse(await userRes.Content.ReadAsStringAsync()).RootElement;

        // GitHub may not expose email publicly — fetch primary verified email
        var email = user.TryGetProperty("email", out var e) && e.ValueKind != JsonValueKind.Null
            ? e.GetString()!
            : await GetPrimaryEmailAsync(client);

        return new OAuthUserInfo(
            Id: user.GetProperty("id").GetInt64().ToString(),
            Email: email ?? $"github_{user.GetProperty("id").GetInt64()}@noemail.local",
            Name: user.TryGetProperty("name", out var n) && n.ValueKind != JsonValueKind.Null ? n.GetString() : null,
            Provider: ProviderName);
    }

    private static async Task<string?> GetPrimaryEmailAsync(HttpClient client)
    {
        var res = await client.GetAsync("https://api.github.com/user/emails");
        if (!res.IsSuccessStatusCode) return null;
        var arr = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        foreach (var item in arr.EnumerateArray())
        {
            if (item.TryGetProperty("primary", out var p) && p.GetBoolean() &&
                item.TryGetProperty("verified", out var v) && v.GetBoolean())
                return item.GetProperty("email").GetString();
        }
        return null;
    }
}
