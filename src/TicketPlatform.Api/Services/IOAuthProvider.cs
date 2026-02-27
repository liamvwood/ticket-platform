namespace TicketPlatform.Api.Services;

public record OAuthUserInfo(string Id, string Email, string? Name, string Provider);

public interface IOAuthProvider
{
    string ProviderName { get; }
    string BuildAuthorizationUrl(string redirectUri, string state, string codeChallenge);
    Task<OAuthUserInfo> GetUserInfoAsync(string code, string redirectUri, string codeVerifier);
}
