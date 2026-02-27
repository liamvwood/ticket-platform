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
public class AuthController(
    AppDbContext db,
    TokenService tokenService,
    IOtpSender otpSender,
    IEnumerable<IOAuthProvider> oauthProviders,
    IConfiguration config) : ControllerBase
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

    // GET /auth/oauth/providers — list enabled providers for the frontend
    [HttpGet("oauth/providers")]
    public ActionResult<object> GetOAuthProviders()
    {
        var isMock = config["OAuth:UseMock"] == "true";
        var providers = isMock
            ? new[] { "Google", "GitHub", "Facebook" }
            : oauthProviders.Where(p => p is not MockOAuthProvider).Select(p => p.ProviderName).ToArray();
        return Ok(new { providers });
    }

    // GET /auth/oauth/authorize?provider=Google&redirectUri=...&state=...&codeChallenge=...
    [HttpGet("oauth/authorize")]
    public ActionResult OAuthAuthorize(
        [FromQuery] string provider,
        [FromQuery] string redirectUri,
        [FromQuery] string state,
        [FromQuery] string codeChallenge)
    {
        var p = oauthProviders.FirstOrDefault(p =>
            string.Equals(p.ProviderName, provider, StringComparison.OrdinalIgnoreCase));
        if (p is null || p is MockOAuthProvider)
            return BadRequest("Unknown or unavailable provider.");

        return Redirect(p.BuildAuthorizationUrl(redirectUri, state, codeChallenge));
    }

    // POST /auth/oauth/callback
    [HttpPost("oauth/callback")]
    public async Task<ActionResult<AuthResponse>> OAuthCallback([FromBody] OAuthCallbackRequest req)
    {
        var p = oauthProviders.FirstOrDefault(p =>
            string.Equals(p.ProviderName, req.Provider, StringComparison.OrdinalIgnoreCase));
        if (p is null) return BadRequest("Unknown provider.");

        OAuthUserInfo info;
        try
        {
            info = await p.GetUserInfoAsync(req.Code, req.RedirectUri, req.CodeVerifier ?? string.Empty);
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = "OAuth exchange failed.", detail = ex.Message });
        }

        var user = await UpsertOAuthUserAsync(info);
        return Ok(new AuthResponse(tokenService.GenerateToken(user), user.Email, user.Role));
    }

    // GET /auth/oauth/mock-login?provider=Google&email=test@example.com (dev/test only)
    [HttpGet("oauth/mock-login")]
    public async Task<ActionResult<AuthResponse>> MockOAuthLogin(
        [FromQuery] string provider = "Google",
        [FromQuery] string email = "mockuser@example.com")
    {
        if (config["OAuth:UseMock"] != "true")
            return NotFound();

        var mock = oauthProviders.OfType<MockOAuthProvider>().FirstOrDefault();
        if (mock is null) return NotFound();

        var info = await mock.GetUserInfoAsync($"{provider}:{email}", string.Empty, string.Empty);
        var user = await UpsertOAuthUserAsync(info);
        return Ok(new AuthResponse(tokenService.GenerateToken(user), user.Email, user.Role));
    }

    private async Task<User> UpsertOAuthUserAsync(OAuthUserInfo info)
    {
        // 1. Look up by provider + external ID (returning user via same provider)
        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.ExternalProvider == info.Provider && u.ExternalId == info.Id);

        if (user is not null)
            return user;

        // 2. Link to existing account by email
        if (!string.IsNullOrEmpty(info.Email) && !info.Email.Contains("@noemail.local"))
            user = await db.Users.FirstOrDefaultAsync(u => u.Email == info.Email.ToLowerInvariant());

        if (user is not null)
        {
            // Link the OAuth identity to the existing account
            user.ExternalProvider ??= info.Provider;
            user.ExternalId ??= info.Id;
            await db.SaveChangesAsync();
            return user;
        }

        // 3. Create new user
        var userId = Guid.NewGuid();
        user = new User
        {
            Id = userId,
            Email = info.Email?.ToLowerInvariant() ?? string.Empty,
            PhoneNumber = string.Empty,
            PasswordHash = string.Empty,
            Role = "User",
            ExternalProvider = info.Provider,
            ExternalId = info.Id,
            ReferralCode = SlugHelper.GenerateReferralCode(userId)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }
}
