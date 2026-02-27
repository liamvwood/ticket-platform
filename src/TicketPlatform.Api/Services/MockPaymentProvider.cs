namespace TicketPlatform.Api.Services;

/// <summary>
/// In-memory mock payment provider for local development and testing.
/// Simulates payment intent creation without calling any external service.
/// </summary>
public class MockPaymentProvider : IPaymentProvider
{
    public Task<PaymentIntentResult> CreatePaymentIntentAsync(Guid orderId, decimal amount)
    {
        var id = $"mock_pi_{orderId:N}";
        var secret = $"{id}_secret_{Guid.NewGuid():N}";
        return Task.FromResult(new PaymentIntentResult(secret, id));
    }
}
