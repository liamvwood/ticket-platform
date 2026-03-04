using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketPlatform.Api.Models;
using TicketPlatform.Api.Services;
using TicketPlatform.Core.Entities;
using TicketPlatform.Core.Enums;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Route("orders")]
[Authorize]
public class OrdersController(AppDbContext db, AppMetrics metrics) : ControllerBase
{
    // POST /orders — create pending order and lock tickets
    [HttpPost]
    public async Task<ActionResult<Order>> Create(CreateOrderRequest req, [FromQuery(Name = "ref")] string? referralCode)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var platformFee = Math.Clamp(req.PlatformFee, 0m, 20m);

        // Normalize: support both multi-item (Items) and legacy single-item (TicketTypeId/Quantity)
        var items = (req.Items is { Count: > 0 })
            ? req.Items
            : [new OrderLineItem(req.TicketTypeId, req.Quantity)];

        // Remove zero-qty items
        items = items.Where(i => i.Quantity > 0).ToList();
        if (items.Count == 0) return BadRequest("No items in order.");

        // Load all ticket types in one query
        var ttIds = items.Select(i => i.TicketTypeId).Distinct().ToList();
        var ticketTypes = await db.TicketTypes
            .Include(tt => tt.Event)
            .Where(tt => ttIds.Contains(tt.Id))
            .ToListAsync();

        // Validate each line
        foreach (var item in items)
        {
            var tt = ticketTypes.FirstOrDefault(t => t.Id == item.TicketTypeId);
            if (tt is null) return NotFound($"TicketType {item.TicketTypeId} not found.");
            if (tt.Event.SaleStartsAt > DateTimeOffset.UtcNow)
                return BadRequest("Tickets are not on sale yet.");
            if (item.Quantity < 1 || item.Quantity > tt.MaxPerOrder)
                return BadRequest($"Quantity for '{tt.Name}' must be between 1 and {tt.MaxPerOrder}.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var allReservedTickets = new List<TicketPlatform.Core.Entities.Ticket>();
            foreach (var item in items)
            {
                var availableTickets = await db.Tickets
                    .FromSqlRaw(
                        "SELECT * FROM \"Tickets\" WHERE \"TicketTypeId\" = {0} AND \"Status\" = 0 LIMIT {1} FOR UPDATE SKIP LOCKED",
                        item.TicketTypeId, item.Quantity)
                    .ToListAsync();

                if (availableTickets.Count < item.Quantity)
                {
                    metrics.OrdersCreatedTotal.WithLabels("conflict").Inc();
                    var ttName = ticketTypes.First(t => t.Id == item.TicketTypeId).Name;
                    return Conflict($"Not enough tickets available for '{ttName}'.");
                }
                allReservedTickets.AddRange(availableTickets);
            }

            var totalAmount = items.Sum(item =>
                ticketTypes.First(t => t.Id == item.TicketTypeId).Price * item.Quantity);

            var order = new Order
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Status = OrderStatus.AwaitingPayment,
                TotalAmount = totalAmount,
                PlatformFee = platformFee,
                ReferredBy = referralCode,
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15)
            };
            db.Orders.Add(order);

            foreach (var ticket in allReservedTickets)
            {
                ticket.Status = TicketStatus.Reserved;
                ticket.OrderId = order.Id;
                ticket.UpdatedAt = DateTimeOffset.UtcNow;
            }

            foreach (var item in items)
            {
                var tt = ticketTypes.First(t => t.Id == item.TicketTypeId);
                tt.QuantitySold += item.Quantity;
            }

            await db.SaveChangesAsync();
            await transaction.CommitAsync();

            metrics.OrdersCreatedTotal.WithLabels("created").Inc();
            metrics.TicketsReservedTotal.Inc(allReservedTickets.Count);

            return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // GET /orders/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Order>> GetById(Guid id)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var order = await db.Orders
            .Include(o => o.Tickets).ThenInclude(t => t.TicketType).ThenInclude(tt => tt.Event)
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);

        return order is null ? NotFound() : Ok(order);
    }

    // GET /orders — my orders
    [HttpGet]
    public async Task<ActionResult<List<Order>>> GetMine()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var orders = await db.Orders
            .Where(o => o.UserId == userId)
            .Include(o => o.Tickets).ThenInclude(t => t.TicketType)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
        return Ok(orders);
    }
}
