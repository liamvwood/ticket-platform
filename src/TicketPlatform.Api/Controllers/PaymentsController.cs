using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;
using TicketPlatform.Api.Services;
using TicketPlatform.Core.Enums;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Controllers;

[ApiController]
[Route("payments")]
public class PaymentsController(AppDbContext db, IConfiguration config, QrTokenService qrTokenService, IPaymentProvider paymentProvider) : ControllerBase
{
    // POST /payments/orders/{orderId}/checkout — create PaymentIntent via configured provider
    [HttpPost("orders/{orderId:guid}/checkout")]
    [Authorize]
    public async Task<ActionResult<object>> CreateCheckout(Guid orderId)
    {
        var order = await db.Orders
            .Include(o => o.Tickets).ThenInclude(t => t.TicketType).ThenInclude(tt => tt.Event)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order is null) return NotFound();
        if (order.Status != OrderStatus.AwaitingPayment) return BadRequest("Order is not awaiting payment.");
        if (order.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest("Order has expired.");

        var result = await paymentProvider.CreatePaymentIntentAsync(order.Id, order.TotalAmount);
        order.StripePaymentIntentId = result.PaymentIntentId;
        await db.SaveChangesAsync();

        return Ok(new { clientSecret = result.ClientSecret, paymentIntentId = result.PaymentIntentId });
    }

    // POST /payments/orders/{orderId}/mock-confirm — simulate payment success (mock provider only)
    [HttpPost("orders/{orderId:guid}/mock-confirm")]
    [Authorize]
    public async Task<IActionResult> MockConfirm(Guid orderId)
    {
        if (paymentProvider is not MockPaymentProvider)
            return NotFound();

        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return NotFound();
        if (order.StripePaymentIntentId is null) return BadRequest("No payment intent on this order.");

        await FinalizeOrder(order.StripePaymentIntentId, (long)(order.TotalAmount * 100));
        return Ok(new { status = "confirmed" });
    }

    // POST /webhooks/stripe — handle Stripe events
    [HttpPost("/webhooks/stripe")]
    public async Task<IActionResult> StripeWebhook()
    {
        var payload = await new StreamReader(Request.Body).ReadToEndAsync();
        var sig = Request.Headers["Stripe-Signature"].ToString();
        var webhookSecret = config["Stripe:WebhookSecret"];

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, sig, webhookSecret);
        }
        catch (StripeException)
        {
            return BadRequest();
        }

        if (stripeEvent.Type == EventTypes.PaymentIntentSucceeded)
        {
            var intent = (PaymentIntent)stripeEvent.Data.Object;
            await FinalizeOrder(intent.Id, intent.Amount);
        }
        else if (stripeEvent.Type == EventTypes.PaymentIntentPaymentFailed)
        {
            var intent = (PaymentIntent)stripeEvent.Data.Object;
            await ReleaseOrder(intent.Id);
        }

        return Ok();
    }

    private async Task FinalizeOrder(string paymentIntentId, long amountCents)
    {
        var order = await db.Orders
            .Include(o => o.Tickets).ThenInclude(t => t.TicketType).ThenInclude(tt => tt.Event)
            .FirstOrDefaultAsync(o => o.StripePaymentIntentId == paymentIntentId);
        if (order is null) return;

        order.Status = OrderStatus.Paid;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        // Issue QR tokens for each ticket (valid until 1h after event ends)
        foreach (var ticket in order.Tickets)
        {
            var expiresAt = ticket.TicketType.Event.EndsAt.AddHours(1);
            ticket.Status = TicketStatus.Sold;
            ticket.QrToken = qrTokenService.Generate(ticket.Id, expiresAt);
            ticket.QrTokenExpiresAt = expiresAt;
            ticket.UpdatedAt = DateTimeOffset.UtcNow;
        }

        db.Payments.Add(new Core.Entities.Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            StripePaymentIntentId = paymentIntentId,
            Amount = amountCents / 100m,
            Status = "succeeded"
        });

        await db.SaveChangesAsync();
    }

    private async Task ReleaseOrder(string paymentIntentId)
    {
        var order = await db.Orders
            .Include(o => o.Tickets)
            .FirstOrDefaultAsync(o => o.StripePaymentIntentId == paymentIntentId);
        if (order is null) return;

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        foreach (var ticket in order.Tickets)
        {
            ticket.Status = TicketStatus.Available;
            ticket.OrderId = null;
            ticket.UpdatedAt = DateTimeOffset.UtcNow;
        }

        // Revert sold count
        var ticketTypeId = order.Tickets.First().TicketTypeId;
        var ticketType = await db.TicketTypes.FindAsync(ticketTypeId);
        if (ticketType is not null) ticketType.QuantitySold -= order.Tickets.Count;

        await db.SaveChangesAsync();
    }
}
