using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

/// <summary>
/// Returns Open Graph meta-tag HTML for social link previews.
/// Social bots (Slack, iMessage, Twitter/X, Discord) request this endpoint
/// when a user pastes an event link into a chat.
/// </summary>
[ApiController]
[Route("og")]
public class OgController(AppDbContext db) : ControllerBase
{
    // GET /og/events/{id} — returns minimal HTML with OG tags for social crawlers
    [HttpGet("events/{id}")]
    [ResponseCache(Duration = 300)]
    public async Task<ContentResult> EventPreview(string id)
    {
        Core.Entities.Event? ev = null;

        if (Guid.TryParse(id, out var guid))
            ev = await db.Events.Include(e => e.Venue).FirstOrDefaultAsync(e => e.Id == guid);
        else
            ev = await db.Events.Include(e => e.Venue).FirstOrDefaultAsync(e => e.Slug == id);

        if (ev is null)
            return Content(MinimalHtml("Austin Tickets", "Find live events in Austin, TX.", null), "text/html");

        var title = $"{ev.Name} — Austin Tickets";
        var desc = $"{ev.StartsAt:ddd, MMM d 'at' h:mm tt} @ {ev.Venue.Name}. {ev.Description}".Truncate(200);
        var imageUrl = $"{Request.Scheme}://{Request.Host}/og/events/{ev.Id}/image";
        var eventUrl = $"https://austintickets.dev/events/{ev.Slug}";

        return Content(MinimalHtml(title, desc, imageUrl, eventUrl), "text/html");
    }

    // GET /og/events/{id}/image — returns a deterministic SVG OG image (1200×630)
    [HttpGet("events/{id}/image")]
    [ResponseCache(Duration = 3600)]
    public async Task<ContentResult> EventImage(string id)
    {
        Core.Entities.Event? ev = null;

        if (Guid.TryParse(id, out var guid))
            ev = await db.Events.Include(e => e.Venue).FirstOrDefaultAsync(e => e.Id == guid);
        else
            ev = await db.Events.Include(e => e.Venue).FirstOrDefaultAsync(e => e.Slug == id);

        var name = ev?.Name ?? "Austin Tickets";
        var venue = ev?.Venue?.Name ?? "Austin, TX";
        var date = ev is not null ? ev.StartsAt.ToString("ddd MMM d, yyyy") : string.Empty;

        // Derive a deterministic gradient from the event name
        var hash = name.Aggregate(0, (h, c) => h * 31 + c);
        var hue1 = Math.Abs(hash % 360);
        var hue2 = (hue1 + 40) % 360;

        var svg = $"""
            <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
              <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="hsl({hue1},60%,20%)"/>
                  <stop offset="100%" stop-color="hsl({hue2},60%,10%)"/>
                </linearGradient>
              </defs>
              <rect width="1200" height="630" fill="url(#bg)"/>
              <rect x="0" y="0" width="1200" height="630" fill="rgba(0,0,0,0.35)"/>
              <!-- Brand -->
              <text x="60" y="80" font-family="Inter,Arial,sans-serif" font-size="26" font-weight="700" fill="rgba(255,255,255,0.6)">🎟 AUSTIN TICKETS</text>
              <!-- Event name -->
              <text x="60" y="320" font-family="Inter,Arial,sans-serif" font-size="72" font-weight="900" fill="#ffffff" style="letter-spacing:-2px">{Escape(name.Truncate(36))}</text>
              <!-- Date + Venue -->
              <text x="60" y="410" font-family="Inter,Arial,sans-serif" font-size="34" fill="rgba(255,255,255,0.8)">{Escape(date)}</text>
              <text x="60" y="460" font-family="Inter,Arial,sans-serif" font-size="30" fill="rgba(255,255,255,0.6)">{Escape(venue.Truncate(50))}</text>
              <!-- CTA pill -->
              <rect x="60" y="520" width="220" height="56" rx="28" fill="hsl({hue1},70%,55%)"/>
              <text x="170" y="555" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">Get Tickets</text>
            </svg>
            """;

        return Content(svg, "image/svg+xml");
    }

    private static string MinimalHtml(string title, string description, string? imageUrl, string? url = null)
    {
        var img = imageUrl is not null
            ? $"""
              <meta property="og:image" content="{imageUrl}"/>
              <meta name="twitter:image" content="{imageUrl}"/>
              <meta name="twitter:card" content="summary_large_image"/>
              """
            : """<meta name="twitter:card" content="summary"/>""";

        var canonical = url is not null ? $"""<link rel="canonical" href="{url}"/>""" : "";

        return $"""
            <!doctype html>
            <html>
            <head>
              <meta charset="utf-8"/>
              <title>{title}</title>
              <meta property="og:type" content="website"/>
              <meta property="og:site_name" content="Austin Tickets"/>
              <meta property="og:title" content="{title}"/>
              <meta property="og:description" content="{description}"/>
              {(url is not null ? $"""<meta property="og:url" content="{url}"/>""" : "")}
              {img}
              <meta name="twitter:title" content="{title}"/>
              <meta name="twitter:description" content="{description}"/>
              {canonical}
            </head>
            <body></body>
            </html>
            """;
    }

    private static string Escape(string s) =>
        s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
}

internal static class StringExtensions
{
    public static string Truncate(this string s, int max) =>
        s.Length <= max ? s : s[..max] + "…";
}
