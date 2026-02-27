namespace TicketPlatform.Core.Entities;

public class Venue
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = "Austin";
    public string State { get; set; } = "TX";
    public Guid? OwnerId { get; set; }              // VenueAdmin user who owns this venue
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Event> Events { get; set; } = [];
}
