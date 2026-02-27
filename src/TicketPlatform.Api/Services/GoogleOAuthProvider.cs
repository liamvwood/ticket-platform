using System.Net.Http.Headers;
using System.Text.Json;

namespace TicketPlatform.Api.Services;

public class GoogleOAuthProvider(IConfiguration config, IHttpClientFactory http) : IOAuthProvider
{
    public string ProviderName => "Google";

    public string BuildAuthorizationUrl(string redirectUri, string state, string codeChallenge) =>
        "https://accounts.google.com/o/oauth2/v2/auth?" + string.Join("&", new Dictionary<string, string>
        {
            ["client_id"] = config["OAuth:Google:ClientId"]!,
            ["redirect_uri"] = redirectUri,
            ["response_type"] = "code",
            ["scope"] = "openid email profile",
            ["state"] = state,
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
            ["access_type"] = "offline",
        }.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

    public async Task<OAuthUserInfo> GetUserInfoAsync(string code, string redirectUri, string codeVerifier)
    {
        using var client = http.CreateClient();

        var tokenRes = await client.PostAsync("https://oauth2.googleapis.com/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = config["OAuth:Google:ClientId"]!,
                ["client_secret"] = config["OAuth:Google:ClientSecret"]!,
                ["redirect_uri"] = redirectUri,
                ["grant_type"] = "authorization_code",
                ["code_verifier"] = codeVerifier,
            }));
        tokenRes.EnsureSuccessStatusCode();

        var tokenDoc = JsonDocument.Parse(await tokenRes.Content.ReadAsStringAsync());
        var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString()!;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var infoRes = await client.GetAsync("https://www.googleapis.com/oauth2/v3/userinfo");
        infoRes.EnsureSuccessStatusCode();

        var info = JsonDocument.Parse(await infoRes.Content.ReadAsStringAsync()).RootElement;
        return new OAuthUserInfo(
            Id: info.GetProperty("sub").GetString()!,
            Email: info.GetProperty("email").GetString()!,
            Name: info.TryGetProperty("name", out var n) ? n.GetString() : null,
            Provider: ProviderName);
    }
}
