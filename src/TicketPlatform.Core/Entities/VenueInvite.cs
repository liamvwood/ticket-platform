namespace TicketPlatform.Core.Entities;

public class VenueInvite
{
    public Guid Id { get; set; }
    public string Token { get; set; } = string.Empty;   // URL-safe random token
    public string Email { get; set; } = string.Empty;   // pre-filled for recipient
    public string VenueName { get; set; } = string.Empty;
    public Guid InvitedById { get; set; }
    public User InvitedBy { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public Guid? CreatedUserId { get; set; }            // set when accepted
}
