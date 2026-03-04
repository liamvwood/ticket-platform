namespace TicketPlatform.Core.Entities;

public class Event
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public DateTimeOffset SaleStartsAt { get; set; }
    public bool IsPublished { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    // Optional recurrence: WEEKLY, BIWEEKLY, MONTHLY, or null for one-time
    public string? RecurringRule { get; set; }

    public Venue Venue { get; set; } = null!;
    public ICollection<TicketType> TicketTypes { get; set; } = [];
}
