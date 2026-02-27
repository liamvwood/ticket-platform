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
public class OrdersController(AppDbContext db) : ControllerBase
{
    // POST /orders — create pending order and lock tickets
    [HttpPost]
    public async Task<ActionResult<Order>> Create(CreateOrderRequest req, [FromQuery(Name = "ref")] string? referralCode)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Clamp platform fee to reasonable range (0–20)
        var platformFee = Math.Clamp(req.PlatformFee, 0m, 20m);

        var ticketType = await db.TicketTypes
            .Include(tt => tt.Event)
            .FirstOrDefaultAsync(tt => tt.Id == req.TicketTypeId);

        if (ticketType is null) return NotFound("TicketType not found.");
        if (ticketType.Event.SaleStartsAt > DateTimeOffset.UtcNow)
            return BadRequest("Tickets are not on sale yet.");
        if (req.Quantity < 1 || req.Quantity > ticketType.MaxPerOrder)
            return BadRequest($"Quantity must be between 1 and {ticketType.MaxPerOrder}.");

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            // Pessimistic lock: grab available tickets with FOR UPDATE SKIP LOCKED
            var availableTickets = await db.Tickets
                .FromSqlRaw(
                    "SELECT * FROM \"Tickets\" WHERE \"TicketTypeId\" = {0} AND \"Status\" = 0 LIMIT {1} FOR UPDATE SKIP LOCKED",
                    req.TicketTypeId, req.Quantity)
                .ToListAsync();

            if (availableTickets.Count < req.Quantity)
                return Conflict("Not enough tickets available.");

            var order = new Order
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Status = OrderStatus.AwaitingPayment,
                TotalAmount = ticketType.Price * req.Quantity,
                PlatformFee = platformFee,
                ReferredBy = referralCode,
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15)
            };
            db.Orders.Add(order);

            foreach (var ticket in availableTickets)
            {
                ticket.Status = TicketStatus.Reserved;
                ticket.OrderId = order.Id;
                ticket.UpdatedAt = DateTimeOffset.UtcNow;
            }

            ticketType.QuantitySold += req.Quantity;
            await db.SaveChangesAsync();
            await transaction.CommitAsync();

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
