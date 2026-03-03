using Microsoft.EntityFrameworkCore;
using TicketPlatform.Core.Enums;
using TicketPlatform.Infrastructure.Data;

namespace TicketPlatform.Api.Services;

/// <summary>
/// Runs only when Payment:Provider=Mock (Development / test ring).
/// Every 30 seconds, finds orders that have been AwaitingPayment for more than
/// 10 seconds and automatically marks them as Paid — so testers don't need to
/// manually call /mock-confirm after placing an order.
/// </summary>
public sealed class AutoConfirmOrdersService(
    IServiceScopeFactory scopeFactory,
    ILogger<AutoConfirmOrdersService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan MinAge    = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("AutoConfirmOrdersService started — pending orders will be confirmed automatically.");

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(Interval, stoppingToken);

            try
            {
                await ConfirmPendingOrdersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "AutoConfirmOrdersService encountered an error.");
            }
        }
    }

    private async Task ConfirmPendingOrdersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTimeOffset.UtcNow - MinAge;

        var orders = await db.Orders
            .Include(o => o.Tickets)
            .Where(o => o.Status == OrderStatus.AwaitingPayment && o.CreatedAt <= cutoff)
            .ToListAsync(ct);

        if (orders.Count == 0) return;

        foreach (var order in orders)
        {
            order.Status = OrderStatus.Paid;
            foreach (var ticket in order.Tickets)
                ticket.Status = TicketStatus.Sold;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("AutoConfirm: confirmed {Count} pending order(s).", orders.Count);
    }
}
