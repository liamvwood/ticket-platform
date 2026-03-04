using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
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
            return Content(MinimalHtml("Slingshot", "Find live events in Austin, TX.", null), "text/html");

        var title = $"{ev.Name} — Slingshot";
        var desc = $"{ev.StartsAt:ddd, MMM d 'at' h:mm tt} @ {ev.Venue.Name}. {ev.Description}".Truncate(200);
        var isGenerated = string.IsNullOrEmpty(ev.ThumbnailUrl);
        var imageUrl = isGenerated
            ? $"{Request.Scheme}://{Request.Host}/og/events/{ev.Id}/image"
            : ev.ThumbnailUrl;
        var imageType = isGenerated ? "image/png" : null;
        var eventUrl = $"https://slingshot.dev/events/{ev.Slug}";

        return Content(MinimalHtml(title, desc, imageUrl, eventUrl, imageType), "text/html");
    }

    // GET /og/events/{id}/image — returns PNG OG image (1200×630), iMessage compatible
    [HttpGet("events/{id}/image")]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> EventImage(string id)
    {
        Response.Headers["Cache-Control"] = "public, max-age=86400";

        Core.Entities.Event? ev = null;
        if (Guid.TryParse(id, out var guid))
            ev = await db.Events.FirstOrDefaultAsync(e => e.Id == guid);
        else
            ev = await db.Events.FirstOrDefaultAsync(e => e.Slug == id);

        int h = Math.Abs((ev?.Id ?? Guid.Empty).GetHashCode());
        var palettes = new (Rgba32 from, Rgba32 to)[] {
            (new Rgba32(0, 255, 136), new Rgba32(167, 139, 250)),
            (new Rgba32(14, 165, 233), new Rgba32(56, 189, 248)),
            (new Rgba32(16, 185, 129), new Rgba32(52, 211, 153)),
            (new Rgba32(245, 158, 11), new Rgba32(251, 191, 36)),
            (new Rgba32(239, 68, 68), new Rgba32(248, 113, 113)),
        };
        var (from, to) = palettes[h % palettes.Length];
        var c1 = new Color(from);
        var c2 = new Color(to);

        using var img = new Image<Rgba32>(1200, 630);
        img.Mutate(ctx => ctx.Fill(new LinearGradientBrush(
            new PointF(0, 0), new PointF(1200, 630),
            GradientRepetitionMode.None,
            new ColorStop(0f, c1), new ColorStop(1f, c2))));

        using var ms = new MemoryStream();
        await img.SaveAsPngAsync(ms);
        return File(ms.ToArray(), "image/png");
    }

    private static string MinimalHtml(string title, string description, string? imageUrl, string? url = null, string? imageType = null)
    {
        var img = imageUrl is not null
            ? $"""
              <meta property="og:image" content="{imageUrl}"/>
              <meta property="og:image:width" content="1200"/>
              <meta property="og:image:height" content="630"/>
              {(imageType is not null ? $"""<meta property="og:image:type" content="{imageType}"/>""" : "")}
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
              <meta property="og:site_name" content="Slingshot"/>
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
