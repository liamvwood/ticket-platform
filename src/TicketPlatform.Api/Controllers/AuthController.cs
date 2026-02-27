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
[Route("auth")]
public class AuthController(AppDbContext db, TokenService tokenService, IOtpSender otpSender) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
    {
        if (await db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict("Email already registered.");

        var userId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            Email = req.Email.ToLowerInvariant(),
            PhoneNumber = req.PhoneNumber,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            ReferralCode = SlugHelper.GenerateReferralCode(userId)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new AuthResponse(tokenService.GenerateToken(user), user.Email, user.Role));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials.");

        return Ok(new AuthResponse(tokenService.GenerateToken(user), user.Email, user.Role));
    }

    // POST /auth/phone/request-otp
    [HttpPost("phone/request-otp")]
    public async Task<ActionResult<object>> RequestOtp([FromBody] PhoneOtpRequest req)
    {
        var phone = req.PhoneNumber?.Trim();
        if (string.IsNullOrEmpty(phone))
            return BadRequest("Phone number is required.");

        // Rate limit: max 3 active codes per phone in the last 10 minutes
        var recentCount = await db.PhoneVerifications
            .CountAsync(v => v.PhoneNumber == phone && v.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-10));
        if (recentCount >= 3)
            return StatusCode(429, new { error = "Too many OTP requests. Please wait before trying again." });

        var code = Random.Shared.Next(100000, 999999).ToString();
        var verification = new PhoneVerification
        {
            Id = Guid.NewGuid(),
            PhoneNumber = phone,
            Code = code,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        db.PhoneVerifications.Add(verification);
        await db.SaveChangesAsync();

        await otpSender.SendAsync(phone, code);

        // In mock mode, surface the code so tests/dev can proceed without SMS
        var isMock = otpSender is MockOtpSender;
        return Ok(isMock
            ? new { message = "Code sent (mock mode — check devCode)", devCode = code }
            : new { message = "Code sent to your phone." });
    }

    // POST /auth/phone/verify-otp
    [HttpPost("phone/verify-otp")]
    public async Task<ActionResult<AuthResponse>> VerifyOtp([FromBody] PhoneVerifyRequest req)
    {
        var phone = req.PhoneNumber?.Trim();
        if (string.IsNullOrEmpty(phone) || string.IsNullOrEmpty(req.Code))
            return BadRequest("Phone number and code are required.");

        var verification = await db.PhoneVerifications
            .Where(v => v.PhoneNumber == phone && !v.Used && v.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();

        if (verification is null)
            return Unauthorized("No valid code found. Request a new one.");

        verification.Attempts++;
        if (verification.Attempts > 5)
        {
            verification.Used = true;
            await db.SaveChangesAsync();
            return Unauthorized("Too many failed attempts. Request a new code.");
        }

        if (verification.Code != req.Code)
        {
            await db.SaveChangesAsync();
            return Unauthorized("Incorrect code.");
        }

        verification.Used = true;
        await db.SaveChangesAsync();

        // Upsert guest user by phone number
        var user = await db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == phone);
        if (user is null)
        {
            var userId = Guid.NewGuid();
            user = new User
            {
                Id = userId,
                PhoneNumber = phone,
                Email = string.Empty,
                PasswordHash = string.Empty,
                Role = "Guest",
                PhoneVerified = true,
                ReferralCode = SlugHelper.GenerateReferralCode(userId)
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }
        else if (!user.PhoneVerified)
        {
            user.PhoneVerified = true;
            await db.SaveChangesAsync();
        }

        return Ok(new AuthResponse(tokenService.GenerateToken(user), user.Email, user.Role));
    }

    // GET /users/me/referrals
    [HttpGet("/users/me/referrals")]
    [Authorize]
    public async Task<ActionResult<object>> GetMyReferrals()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        var count = await db.Orders.CountAsync(o => o.ReferredBy == user.ReferralCode);
        return Ok(new { referralCode = user.ReferralCode, referralCount = count });
    }
}
