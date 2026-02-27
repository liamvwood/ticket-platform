using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Api.Models;
using TicketPlatform.Api.Services;
using TicketPlatform.Core.Entities;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Route("events")]
public class EventsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<Event>>> GetAll()
    {
        return await db.Events
            .Where(e => e.IsPublished)
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .OrderBy(e => e.StartsAt)
            .ToListAsync();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Event>> GetById(Guid id)
    {
        var ev = await db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .FirstOrDefaultAsync(e => e.Id == id);

        return ev is null ? NotFound() : Ok(ev);
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<Event>> GetBySlug(string slug)
    {
        var ev = await db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .FirstOrDefaultAsync(e => e.Slug == slug);

        return ev is null ? NotFound() : Ok(ev);
    }

    [HttpPost]
    [Authorize(Roles = "VenueAdmin")]
    public async Task<ActionResult<Event>> Create(CreateEventRequest req)
    {
        var venue = await db.Venues.FindAsync(req.VenueId);
        if (venue is null) return BadRequest("Venue not found.");

        var ev = new Event
        {
            Id = Guid.NewGuid(),
            VenueId = req.VenueId,
            Name = req.Name,
            Description = req.Description,
            StartsAt = req.StartsAt,
            EndsAt = req.EndsAt,
            SaleStartsAt = req.SaleStartsAt,
            IsPublished = false
        };
        ev.Slug = SlugHelper.Generate(ev.Name, ev.Id);

        db.Events.Add(ev);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = ev.Id }, ev);
    }

    [HttpPut("{id:guid}/publish")]
    [Authorize(Roles = "VenueAdmin")]
    public async Task<IActionResult> Publish(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();
        ev.IsPublished = true;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{eventId:guid}/ticket-types")]
    [Authorize(Roles = "VenueAdmin")]
    public async Task<ActionResult<TicketType>> CreateTicketType(Guid eventId, CreateTicketTypeRequest req)
    {
        var ev = await db.Events.FindAsync(eventId);
        if (ev is null) return NotFound("Event not found.");

        var ticketType = new TicketType
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Name = req.Name,
            Price = req.Price,
            TotalQuantity = req.TotalQuantity,
            MaxPerOrder = req.MaxPerOrder
        };

        // Pre-allocate individual ticket records
        var tickets = Enumerable.Range(0, req.TotalQuantity)
            .Select(_ => new Ticket { Id = Guid.NewGuid(), TicketTypeId = ticketType.Id })
            .ToList();

        db.TicketTypes.Add(ticketType);
        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = eventId }, ticketType);
    }
}
