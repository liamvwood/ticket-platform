using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Api.Models;
using TicketPlatform.Api.Services;
using TicketPlatform.Core.Enums;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Route("checkin")]
public class CheckInController(AppDbContext db, QrTokenService qrTokenService) : ControllerBase
{
    // POST /checkin/validate — validate QR token and check in
    [HttpPost("validate")]
    [Authorize(Roles = "Scanner,VenueAdmin")]
    public async Task<ActionResult<object>> Validate(QrValidationRequest req)
    {
        var (valid, ticketId) = qrTokenService.Validate(req.Token);
        if (!valid)
            return Ok(new { status = "Invalid", message = "Token is invalid or expired." });

        var ticket = await db.Tickets
            .Include(t => t.TicketType).ThenInclude(tt => tt.Event)
            .FirstOrDefaultAsync(t => t.Id == ticketId);

        if (ticket is null)
            return Ok(new { status = "Invalid", message = "Ticket not found." });

        return ticket.Status switch
        {
            TicketStatus.CheckedIn => Ok(new { status = "Duplicate", message = "Already checked in." }),
            TicketStatus.Refunded => Ok(new { status = "Refunded", message = "Ticket has been refunded." }),
            TicketStatus.Cancelled => Ok(new { status = "Invalid", message = "Ticket is cancelled." }),
            TicketStatus.Sold => await DoCheckIn(ticket),
            _ => Ok(new { status = "Invalid", message = $"Unexpected ticket state: {ticket.Status}." })
        };
    }

    private async Task<ActionResult<object>> DoCheckIn(Core.Entities.Ticket ticket)
    {
        var scannerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        ticket.Status = TicketStatus.CheckedIn;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        db.CheckIns.Add(new Core.Entities.CheckIn
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            ScannedByUserId = scannerId
        });

        await db.SaveChangesAsync();

        return Ok(new
        {
            status = "Valid",
            message = "Check-in successful.",
            ticketId = ticket.Id,
            eventName = ticket.TicketType.Event.Name,
            ticketType = ticket.TicketType.Name
        });
    }
}
