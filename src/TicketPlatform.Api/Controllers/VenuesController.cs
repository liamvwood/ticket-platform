using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Route("venues")]
public class VenuesController(AppDbContext db) : ControllerBase
{
    // GET /venues — AppOwner gets all venues; VenueAdmin gets their own
    [HttpGet]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<ActionResult<object>> GetVenues()
    {
        var venues = await db.Venues
            .Select(v => new { v.Id, v.Name, v.OwnerId })
            .ToListAsync();
        return Ok(venues);
    }

    // POST /venues — AppOwner creates a new venue
    [HttpPost]
    [Authorize(Roles = "AppOwner")]
    public async Task<ActionResult<object>> CreateVenue([FromBody] CreateVenueRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Venue name is required.");

        var venue = new TicketPlatform.Core.Entities.Venue
        {
            Id = Guid.NewGuid(),
            Name = req.Name.Trim(),
            Address = req.Address?.Trim() ?? "",
            City = req.City?.Trim() ?? "",
            State = req.State?.Trim() ?? "",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Venues.Add(venue);
        await db.SaveChangesAsync();
        return Ok(new { venue.Id, venue.Name });
    }
}

public record CreateVenueRequest(string Name, string? Address, string? City, string? State);
