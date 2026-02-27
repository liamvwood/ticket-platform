namespace TicketPlatform.Core.Entities;

public class CheckIn
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid ScannedByUserId { get; set; }
    public DateTimeOffset ScannedAt { get; set; } = DateTimeOffset.UtcNow;

    public Ticket Ticket { get; set; } = null!;
}
