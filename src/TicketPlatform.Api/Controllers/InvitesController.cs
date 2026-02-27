using System.Security.Claims;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Api.Models;
using TicketPlatform.Api.Services;
using TicketPlatform.Core.Entities;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
public class InvitesController(AppDbContext db, TokenService tokenService, IConfiguration config) : ControllerBase
{
    private static readonly TimeSpan InviteTtl = TimeSpan.FromDays(7);

    // POST /admin/invites — AppOwner only
    [HttpPost("admin/invites")]
    [Authorize(Roles = "AppOwner")]
    public async Task<ActionResult<object>> CreateInvite([FromBody] CreateInviteRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.VenueName))
            return BadRequest("Email and venue name are required.");

        var inviterId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Revoke any existing unused invite for the same email
        var existing = await db.VenueInvites
            .Where(i => i.Email == req.Email.ToLowerInvariant() && i.UsedAt == null)
            .ToListAsync();
        db.VenueInvites.RemoveRange(existing);

        var token = GenerateToken();
        var invite = new VenueInvite
        {
            Id = Guid.NewGuid(),
            Token = token,
            Email = req.Email.ToLowerInvariant(),
            VenueName = req.VenueName.Trim(),
            InvitedById = inviterId,
            ExpiresAt = DateTimeOffset.UtcNow.Add(InviteTtl),
        };
        db.VenueInvites.Add(invite);
        await db.SaveChangesAsync();

        var baseUrl = config["AppBaseUrl"] ?? "http://localhost:5173";
        return Ok(new
        {
            inviteUrl = $"{baseUrl}/invite/{token}",
            token,
            email = invite.Email,
            venueName = invite.VenueName,
            expiresAt = invite.ExpiresAt,
        });
    }

    // GET /admin/invites — AppOwner only, list all invites
    [HttpGet("admin/invites")]
    [Authorize(Roles = "AppOwner")]
    public async Task<ActionResult<object>> ListInvites()
    {
        var invites = await db.VenueInvites
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.Email,
                i.VenueName,
                i.CreatedAt,
                i.ExpiresAt,
                i.UsedAt,
                status = i.UsedAt != null ? "used"
                       : i.ExpiresAt < DateTimeOffset.UtcNow ? "expired"
                       : "pending",
            })
            .ToListAsync();
        return Ok(invites);
    }

    // DELETE /admin/invites/{id} — revoke an unused invite
    [HttpDelete("admin/invites/{id:guid}")]
    [Authorize(Roles = "AppOwner")]
    public async Task<IActionResult> RevokeInvite(Guid id)
    {
        var invite = await db.VenueInvites.FindAsync(id);
        if (invite is null) return NotFound();
        if (invite.UsedAt is not null) return BadRequest("Invite already used.");
        db.VenueInvites.Remove(invite);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // GET /invites/{token} — public; returns invite details for the accept page
    [HttpGet("invites/{token}")]
    public async Task<ActionResult<object>> GetInvite(string token)
    {
        var invite = await db.VenueInvites.FirstOrDefaultAsync(i => i.Token == token);
        if (invite is null) return NotFound(new { error = "Invite not found." });
        if (invite.UsedAt is not null) return Conflict(new { error = "This invite has already been used." });
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return StatusCode(410, new { error = "This invite has expired." });

        return Ok(new
        {
            invite.Email,
            invite.VenueName,
            invite.ExpiresAt,
        });
    }

    // POST /invites/{token}/accept — create or upgrade to VenueAdmin + Venue
    [HttpPost("invites/{token}/accept")]
    public async Task<ActionResult<AuthResponse>> AcceptInvite(string token, [FromBody] AcceptInviteRequest req)
    {
        var invite = await db.VenueInvites.FirstOrDefaultAsync(i => i.Token == token);
        if (invite is null) return NotFound(new { error = "Invite not found." });
        if (invite.UsedAt is not null) return Conflict(new { error = "This invite has already been used." });
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return StatusCode(410, new { error = "This invite has expired." });

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
            return BadRequest(new { error = "Password must be at least 8 characters." });

        User user;
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == invite.Email);

        if (existing is not null)
        {
            // An account with this email already exists (e.g. created via OAuth or normal register
            // before the invite was accepted). Upgrade it to VenueAdmin and set the password.
            existing.Role = "VenueAdmin";
            existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
            if (!string.IsNullOrWhiteSpace(req.PhoneNumber))
                existing.PhoneNumber = req.PhoneNumber.Trim();
            user = existing;
        }
        else
        {
            var userId = Guid.NewGuid();
            user = new User
            {
                Id = userId,
                Email = invite.Email,
                PhoneNumber = req.PhoneNumber?.Trim() ?? string.Empty,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                Role = "VenueAdmin",
                ReferralCode = SlugHelper.GenerateReferralCode(userId),
            };
            db.Users.Add(user);
        }

        // Create the venue (only if one doesn't already exist for this owner)
        var venueExists = await db.Venues.AnyAsync(v => v.OwnerId == user.Id);
        if (!venueExists)
        {
            db.Venues.Add(new Venue
            {
                Id = Guid.NewGuid(),
                Name = invite.VenueName,
                OwnerId = user.Id,
            });
        }

        // Mark invite used
        invite.UsedAt = DateTimeOffset.UtcNow;
        invite.CreatedUserId = user.Id;

        await db.SaveChangesAsync();

        return StatusCode(201, new AuthResponse(tokenService.GenerateToken(user), user.Email, user.Role));
    }

    private static string GenerateToken()
    {
        var bytes = new byte[32];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
