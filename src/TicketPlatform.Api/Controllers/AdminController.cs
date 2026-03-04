using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Authorize(Roles = "AppOwner")]
public class AdminController(AppDbContext db) : ControllerBase
{
    // GET /admin/users — list VenueAdmins and AppOwners
    [HttpGet("admin/users")]
    public async Task<IActionResult> GetAdminUsers()
    {
        var users = await db.Users
            .Where(u => u.Role == "VenueAdmin" || u.Role == "AppOwner")
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Email)
            .Select(u => new { u.Id, u.Email, u.Role })
            .ToListAsync();
        return Ok(users);
    }

    // DELETE /admin/users/{userId}/admin-role — revoke VenueAdmin role
    [HttpDelete("admin/users/{userId:guid}/admin-role")]
    public async Task<IActionResult> RevokeAdminRole(Guid userId)
    {
        var callerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (userId == callerId)
            return BadRequest(new { error = "You cannot revoke your own admin role." });

        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();
        if (user.Role != "VenueAdmin") return BadRequest(new { error = "User does not have VenueAdmin role." });

        user.Role = "User";
        await db.SaveChangesAsync();
        return NoContent();
    }
}
