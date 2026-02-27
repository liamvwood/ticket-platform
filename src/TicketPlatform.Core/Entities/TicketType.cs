namespace TicketPlatform.Core.Entities;

public class TicketType
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string Name { get; set; } = string.Empty; // e.g. "General Admission", "VIP"
    public decimal Price { get; set; }
    public int TotalQuantity { get; set; }
    public int QuantitySold { get; set; }
    public int MaxPerOrder { get; set; } = 4;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Event Event { get; set; } = null!;
    public ICollection<Ticket> Tickets { get; set; } = [];
}
