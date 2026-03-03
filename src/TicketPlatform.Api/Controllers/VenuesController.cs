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
}
