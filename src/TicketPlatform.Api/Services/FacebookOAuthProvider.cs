using System.Net.Http.Headers;
using System.Text.Json;

namespace TicketPlatform.Api.Services;

public class FacebookOAuthProvider(IConfiguration config, IHttpClientFactory http) : IOAuthProvider
{
    public string ProviderName => "Facebook";

    public string BuildAuthorizationUrl(string redirectUri, string state, string codeChallenge) =>
        "https://www.facebook.com/v20.0/dialog/oauth?" + string.Join("&", new Dictionary<string, string>
        {
            ["client_id"] = config["OAuth:Facebook:AppId"]!,
            ["redirect_uri"] = redirectUri,
            ["scope"] = "email public_profile",
            ["state"] = state,
            ["response_type"] = "code",
        }.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

    public async Task<OAuthUserInfo> GetUserInfoAsync(string code, string redirectUri, string codeVerifier)
    {
        using var client = http.CreateClient();

        var tokenRes = await client.GetAsync(
            $"https://graph.facebook.com/v20.0/oauth/access_token" +
            $"?client_id={Uri.EscapeDataString(config["OAuth:Facebook:AppId"]!)}" +
            $"&client_secret={Uri.EscapeDataString(config["OAuth:Facebook:AppSecret"]!)}" +
            $"&code={Uri.EscapeDataString(code)}" +
            $"&redirect_uri={Uri.EscapeDataString(redirectUri)}");
        tokenRes.EnsureSuccessStatusCode();

        var tokenDoc = JsonDocument.Parse(await tokenRes.Content.ReadAsStringAsync());
        var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString()!;

        var infoRes = await client.GetAsync(
            $"https://graph.facebook.com/me?fields=id,name,email&access_token={Uri.EscapeDataString(accessToken)}");
        infoRes.EnsureSuccessStatusCode();

        var info = JsonDocument.Parse(await infoRes.Content.ReadAsStringAsync()).RootElement;
        var email = info.TryGetProperty("email", out var e) ? e.GetString() : null;

        return new OAuthUserInfo(
            Id: info.GetProperty("id").GetString()!,
            Email: email ?? $"fb_{info.GetProperty("id").GetString()}@noemail.local",
            Name: info.TryGetProperty("name", out var n) ? n.GetString() : null,
            Provider: ProviderName);
    }
}
