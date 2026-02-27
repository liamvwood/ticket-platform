using System.Security.Cryptography;
using System.Text;

namespace TicketPlatform.Api.Services;

public class QrTokenService(IConfiguration config)
{
    private readonly string _secret = config["Jwt:Secret"]!;

    public string Generate(Guid ticketId, DateTimeOffset expiresAt)
    {
        var payload = $"{ticketId}|{expiresAt.ToUnixTimeSeconds()}";
        var sig = Sign(payload);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{payload}|{sig}"));
    }

    public (bool valid, Guid ticketId) Validate(string token)
    {
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var parts = raw.Split('|');
            if (parts.Length != 3) return (false, Guid.Empty);

            var payload = $"{parts[0]}|{parts[1]}";
            if (Sign(payload) != parts[2]) return (false, Guid.Empty);

            var expiresAt = DateTimeOffset.FromUnixTimeSeconds(long.Parse(parts[1]));
            if (expiresAt < DateTimeOffset.UtcNow) return (false, Guid.Empty);

            return (true, Guid.Parse(parts[0]));
        }
        catch
        {
            return (false, Guid.Empty);
        }
    }

    private string Sign(string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }
}
