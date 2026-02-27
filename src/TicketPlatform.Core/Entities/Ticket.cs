using TicketPlatform.Core.Enums;

namespace TicketPlatform.Core.Entities;

public class Ticket
{
    public Guid Id { get; set; }
    public Guid TicketTypeId { get; set; }
    public Guid? OrderId { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.Available;
    public string? QrToken { get; set; }
    public DateTimeOffset? QrTokenExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public TicketType TicketType { get; set; } = null!;
    public Order? Order { get; set; }
    public CheckIn? CheckIn { get; set; }
}
