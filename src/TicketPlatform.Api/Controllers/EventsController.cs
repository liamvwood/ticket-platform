using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TicketPlatform.Api.Models;
using TicketPlatform.Api.Services;
using TicketPlatform.Core.Entities;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Route("events")]
public class EventsController(AppDbContext db, AppMetrics metrics, IStorageService storage, IPaymentProvider paymentProvider, IConfiguration config) : ControllerBase
{
    private readonly string? _cdnDomain = config["Aws:CdnDomain"];
    private const int DefaultPageSize = 12;
    private const int MaxPageSize = 100;

    // GET /events?page=1&pageSize=12&type=comedy&date=today&hot=true&tab=past
    [HttpGet]
    public async Task<ActionResult<EventsPagedResult>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? type = null,
        [FromQuery] string? date = null,
        [FromQuery] bool? hot = null,
        [FromQuery] bool? dropping = null,
        [FromQuery] string? tab = null)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(1, page);

        var now = DateTimeOffset.UtcNow;

        var query = db.Events
            .Where(e => e.IsPublished)
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .AsQueryable();

        // Tab filter: past vs upcoming (default)
        if (tab == "past")
            query = query.Where(e => e.StartsAt < now);
        else
            query = query.Where(e => e.StartsAt >= now);

        // Type filter (case-insensitive)
        if (!string.IsNullOrWhiteSpace(type))
        {
            var typeLower = type.ToLowerInvariant();
            query = query.Where(e => e.EventType.ToLower() == typeLower);
        }

        // Date filter
        if (date == "today")
        {
            var todayStart = new DateTimeOffset(now.Date, TimeSpan.Zero);
            var todayEnd = todayStart.AddDays(1);
            query = query.Where(e => e.StartsAt >= todayStart && e.StartsAt < todayEnd);
        }
        else if (date == "upcoming")
        {
            query = query.Where(e => e.StartsAt > now);
        }

        // Compute hot event IDs from DB
        var twoHoursAgo = now.AddHours(-2);
        var hotEventIds = await GetHotEventIdsAsync(twoHoursAgo);

        // Hot filter
        if (hot == true)
            query = query.Where(e => hotEventIds.Contains(e.Id));

        // Dropping soon filter: SaleStartsAt within the next 24 hours
        if (dropping == true)
            query = query.Where(e => e.SaleStartsAt > now && e.SaleStartsAt <= now.AddHours(24));

        var orderedQuery = tab == "past"
            ? query.OrderByDescending(e => e.StartsAt)
            : query.OrderBy(e => e.StartsAt);

        var totalCount = await query.CountAsync();
        var items = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtoItems = items.Select(e => ToDto(e, hotEventIds, now, _cdnDomain)).ToList();

        return Ok(new EventsPagedResult(
            Items: dtoItems,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)
        ));
    }

    [HttpGet("types")]
    public IActionResult GetEventTypes()
    {
        var types = new[] { "comedy", "music", "sports", "arts", "food", "tech", "other" };
        return Ok(types);
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

        var now = DateTimeOffset.UtcNow;
        var twoHoursAgo = now.AddHours(-2);
        var hotEventIds = await GetHotEventIdsAsync(twoHoursAgo);

        var query = db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .OrderByDescending(e => e.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtoItems = items.Select(e => ToDto(e, hotEventIds, now, _cdnDomain)).ToList();

        return Ok(new EventsPagedResult(
            Items: dtoItems,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)
        ));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var ev = await db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .FirstOrDefaultAsync(e => e.Id == id);

        return ev is null ? NotFound() : Ok(ToDto(ev, [], DateTimeOffset.UtcNow, _cdnDomain));
    }

    [HttpGet("{slug}")]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var ev = await db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
            .FirstOrDefaultAsync(e => e.Slug == slug);

        return ev is null ? NotFound() : Ok(ToDto(ev, [], DateTimeOffset.UtcNow, _cdnDomain));
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
            },
            EventType = req.EventType ?? "other"
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
        if (!string.IsNullOrWhiteSpace(req.EventType)) ev.EventType = req.EventType ?? "other";

        await db.SaveChangesAsync();
        return Ok(new { ev.Id, ev.Name, ev.Description, ev.StartsAt, ev.EndsAt, ev.IsPublished });
    }

    // POST /events/{id:guid}/image-upload-url — generate a presigned S3 PUT URL for direct client upload
    // The event's ThumbnailUrl is pre-saved as the CDN URL (deterministic, based on event ID).
    // The client uploads the original JPEG directly to S3, then the CDN serves it on-demand.
    [HttpPost("{id:guid}/image-upload-url")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> GetImageUploadUrl(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();

        // Use event ID so OgController and responsive images use the same deterministic CDN path
        var result = await storage.GeneratePresignedUploadUrlAsync(id);

        // Pre-save the CDN URL so it's available immediately after the client completes the PUT
        if (result.CdnImageUrl is not null)
        {
            ev.ThumbnailUrl = result.CdnImageUrl;
            await db.SaveChangesAsync();
        }

        return Ok(new
        {
            uploadUrl = result.UploadUrl,
            imageId = result.ImageId,
            cdnImageUrl = result.CdnImageUrl,
            expiresInSeconds = 900,
        });
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

    // POST /events/{id}/cancel — cancel event and refund all paid orders
    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelEventRequest req)
    {
        var ev = await db.Events
            .Include(e => e.Venue)
            .Include(e => e.TicketTypes)
                .ThenInclude(tt => tt.Tickets)
                    .ThenInclude(t => t.Order)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (ev is null) return NotFound();
        if (ev.IsCancelled) return Conflict("Event is already cancelled.");

        if (!User.IsInRole("AppOwner"))
        {
            var callerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (ev.Venue?.OwnerId != callerId) return Forbid();
        }

        // Refund all paid orders and void reserved ones
        var processedOrders = new HashSet<Guid>();
        foreach (var ticket in ev.TicketTypes.SelectMany(tt => tt.Tickets))
        {
            var order = ticket.Order;
            if (order is null || processedOrders.Contains(order.Id)) continue;
            processedOrders.Add(order.Id);

            if (order.Status == Core.Enums.OrderStatus.Paid && order.StripePaymentIntentId is not null)
            {
                await paymentProvider.RefundAsync(order.StripePaymentIntentId);
                order.Status = Core.Enums.OrderStatus.Refunded;
            }
            else if (order.Status == Core.Enums.OrderStatus.AwaitingPayment)
            {
                order.Status = Core.Enums.OrderStatus.Cancelled;
            }

            order.UpdatedAt = DateTimeOffset.UtcNow;
            foreach (var t in order.Tickets)
            {
                t.Status = Core.Enums.TicketStatus.Cancelled;
                t.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        ev.IsCancelled = true;
        ev.CancelledAt = DateTimeOffset.UtcNow;
        ev.CancellationReason = req.Reason?.Trim();
        ev.IsPublished = false;
        await db.SaveChangesAsync();
        metrics.EventsPublishedTotal.Inc(); // reuse counter — in production add a dedicated cancellation counter
        return NoContent();
    }

    // POST /events/{id}/release-funds — AppOwner releases held funds to venue after event ends
    [HttpPost("{id:guid}/release-funds")]
    [Authorize(Roles = "AppOwner")]
    public async Task<IActionResult> ReleaseFunds(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();
        if (ev.IsCancelled) return Conflict("Cannot release funds for a cancelled event.");
        if (ev.FundsReleasedAt is not null) return Conflict("Funds have already been released.");
        if (ev.EndsAt > DateTimeOffset.UtcNow) return BadRequest("Event has not ended yet.");

        ev.FundsReleasedAt = DateTimeOffset.UtcNow;
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

    [HttpDelete("{eventId:guid}")]
    [Authorize(Roles = "VenueAdmin,AppOwner")]
    public async Task<IActionResult> DeleteEvent(Guid eventId, [FromQuery] bool force = false)
    {
        var ev = await db.Events
            .Include(e => e.TicketTypes)
                .ThenInclude(tt => tt.Tickets)
            .Include(e => e.Venue)
            .FirstOrDefaultAsync(e => e.Id == eventId);
        if (ev is null) return NotFound();

        // VenueAdmins may only delete events belonging to their own venue
        if (!User.IsInRole("AppOwner"))
        {
            var callerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (ev.Venue?.OwnerId != callerId)
                return Forbid();
        }

        // force=true (AppOwner only) bypasses sold-ticket guard — used for test/dev cleanup of mock-payment data
        if (force && !User.IsInRole("AppOwner"))
            return Forbid();

        if (!force)
        {
            var hasSoldTickets = ev.TicketTypes
                .SelectMany(tt => tt.Tickets)
                .Any(t => t.Status != Core.Enums.TicketStatus.Available);
            if (hasSoldTickets)
                return Conflict("Cannot delete an event with sold or reserved tickets. Cancel the event first to issue refunds.");
        }

        foreach (var tt in ev.TicketTypes)
            db.Tickets.RemoveRange(tt.Tickets);
        db.TicketTypes.RemoveRange(ev.TicketTypes);
        db.Events.Remove(ev);
        await db.SaveChangesAsync();
        return NoContent();
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

    private async Task<HashSet<Guid>> GetHotEventIdsAsync(DateTimeOffset since)
    {
        var ids = await (
            from t in db.Tickets
            join o in db.Orders on t.OrderId equals o.Id
            join tt in db.TicketTypes on t.TicketTypeId equals tt.Id
            where o.CreatedAt > since
            group t by tt.EventId into g
            where g.Count() >= 3
            select g.Key
        ).ToListAsync();
        return ids.ToHashSet();
    }

    private static EventResponseDto ToDto(Event e, HashSet<Guid> hotEventIds, DateTimeOffset now, string? cdnDomain) => new(
        Id: e.Id,
        VenueId: e.VenueId,
        Name: e.Name,
        Slug: e.Slug,
        Description: e.Description,
        ThumbnailUrl: e.ThumbnailUrl,
        CdnImageBase: !string.IsNullOrWhiteSpace(cdnDomain) && !string.IsNullOrWhiteSpace(e.ThumbnailUrl)
            ? $"https://{cdnDomain}"
            : null,
        StartsAt: e.StartsAt,
        EndsAt: e.EndsAt,
        SaleStartsAt: e.SaleStartsAt,
        IsPublished: e.IsPublished,
        CreatedAt: e.CreatedAt,
        RecurringRule: e.RecurringRule,
        EventType: e.EventType,
        IsHot: hotEventIds.Contains(e.Id),
        TicketsDroppingSoon: e.SaleStartsAt > now && e.SaleStartsAt < now.AddHours(24),
        IsCancelled: e.IsCancelled,
        CancellationReason: e.CancellationReason,
        FundsReleasedAt: e.FundsReleasedAt,
        Venue: e.Venue,
        TicketTypes: e.TicketTypes
    );
}
