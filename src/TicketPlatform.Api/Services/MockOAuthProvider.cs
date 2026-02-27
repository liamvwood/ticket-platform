namespace TicketPlatform.Api.Services;

/// <summary>
/// Mock OAuth provider for local development and testing.
/// Accepts any email — no real OAuth flow needed.
/// Accessed via GET /auth/oauth/mock-login?provider=Google&email=test@example.com
/// </summary>
public class MockOAuthProvider : IOAuthProvider
{
    public string ProviderName => "Mock";

    public string BuildAuthorizationUrl(string redirectUri, string state, string codeChallenge) =>
        throw new NotSupportedException("MockOAuthProvider does not build real URLs.");

    public Task<OAuthUserInfo> GetUserInfoAsync(string code, string redirectUri, string codeVerifier)
    {
        // code encodes "provider:email" when called from mock endpoint
        var parts = code.Split(':', 2);
        var provider = parts.Length == 2 ? parts[0] : "Google";
        var email = parts.Length == 2 ? parts[1] : code;
        return Task.FromResult(new OAuthUserInfo(
            Id: $"mock_{email.GetHashCode():x8}",
            Email: email,
            Name: email.Split('@')[0],
            Provider: provider));
    }
}
