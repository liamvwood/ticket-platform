namespace TicketPlatform.Core.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "User"; // User | VenueAdmin | Scanner | Guest
    public bool PhoneVerified { get; set; }
    public string ReferralCode { get; set; } = string.Empty;
    // Social / OAuth login
    public string? ExternalProvider { get; set; } // "Google" | "GitHub" | "Facebook"
    public string? ExternalId { get; set; }       // provider's unique user ID
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Order> Orders { get; set; } = [];
}
