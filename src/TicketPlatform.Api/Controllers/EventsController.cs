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
public class EventsController(AppDbContext db, AppMetrics metrics, IStorageService storage) : ControllerBase
{
    private const int DefaultPageSize = 12;
    private const int MaxPageSize = 100;

    // GET /events?page=1&pageSize=12
    [HttpGet]
    public async Task<ActionResult<EventsPagedResult>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(1, page);

        var query = db.Events
            .Where(e => e.IsPublished)
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .OrderBy(e => e.StartsAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new EventsPagedResult(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)
        ));
    }

    // GET /events/admin — all events (published + draft) for AppOwner
    [HttpGet("admin")]
    [Authorize(Roles = "AppOwner")]
    public async Task<ActionResult<EventsPagedResult>> GetAllAdmin(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(1, page);

        var query = db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .OrderByDescending(e => e.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new EventsPagedResult(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)
        ));
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
    [Authorize(Roles = "VenueAdmin,AppOwner")]
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
            IsPublished = false,
            RecurringRule = req.RecurringRule?.ToUpperInvariant() switch
            {
                "WEEKLY" or "BIWEEKLY" or "MONTHLY" => req.RecurringRule.ToUpperInvariant(),
                _ => null
            }
        };
        ev.Slug = SlugHelper.Generate(ev.Name, ev.Id);

        db.Events.Add(ev);
        await db.SaveChangesAsync();
        metrics.EventsCreatedTotal.Inc();
        return CreatedAtAction(nameof(GetById), new { id = ev.Id }, ev);
    }

    // PATCH /events/{id} — update editable event fields
    [HttpPatch("{id:guid}")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEventRequest req)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Name)) { ev.Name = req.Name.Trim(); ev.Slug = SlugHelper.Generate(ev.Name, ev.Id); }
        if (!string.IsNullOrWhiteSpace(req.Description)) ev.Description = req.Description.Trim();
        if (req.StartsAt.HasValue) ev.StartsAt = req.StartsAt.Value;
        if (req.EndsAt.HasValue) ev.EndsAt = req.EndsAt.Value;

        await db.SaveChangesAsync();
        return Ok(new { ev.Id, ev.Name, ev.Description, ev.StartsAt, ev.EndsAt, ev.IsPublished });
    }

    // POST /events/{id}/thumbnail — multipart file upload (JPEG/PNG/WebP)
    [HttpPost("{id:guid}/thumbnail")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5 MB max
    public async Task<IActionResult> UploadThumbnail(Guid id, IFormFile file)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();

        var allowed = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowed.Contains(file.ContentType))
            return BadRequest("Only JPEG, PNG, WebP and GIF images are accepted.");

        await using var stream = file.OpenReadStream();
        ev.ThumbnailUrl = await storage.UploadEventThumbnailAsync(id, stream, file.ContentType);
        await db.SaveChangesAsync();

        return Ok(new { thumbnailUrl = ev.ThumbnailUrl });
    }

    [HttpPut("{id:guid}/publish")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> Publish(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();
        ev.IsPublished = true;
        await db.SaveChangesAsync();
        metrics.EventsPublishedTotal.Inc();
        return NoContent();
    }

    [HttpPut("{id:guid}/unpublish")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> Unpublish(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();
        ev.IsPublished = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{eventId:guid}/ticket-types")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
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

        var tickets = Enumerable.Range(0, req.TotalQuantity)
            .Select(_ => new Ticket { Id = Guid.NewGuid(), TicketTypeId = ticketType.Id })
            .ToList();

        db.TicketTypes.Add(ticketType);
        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = eventId }, ticketType);
    }

    [HttpDelete("{eventId:guid}/ticket-types/{ticketTypeId:guid}")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> DeleteTicketType(Guid eventId, Guid ticketTypeId)
    {
        var tt = await db.TicketTypes
            .Include(t => t.Tickets)
            .FirstOrDefaultAsync(t => t.Id == ticketTypeId && t.EventId == eventId);
        if (tt is null) return NotFound();
        if (tt.Tickets.Any(t => t.Status != TicketPlatform.Core.Enums.TicketStatus.Available))
            return Conflict("Cannot delete a ticket type with sold or reserved tickets.");
        db.Tickets.RemoveRange(tt.Tickets);
        db.TicketTypes.Remove(tt);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
