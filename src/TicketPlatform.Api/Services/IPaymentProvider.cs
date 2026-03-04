namespace TicketPlatform.Api.Services;

public interface IPaymentProvider
{
    Task<PaymentIntentResult> CreatePaymentIntentAsync(Guid orderId, decimal amount);
    /// <summary>Issue a full refund for the given payment intent. No-op for mock payments.</summary>
    Task RefundAsync(string paymentIntentId);
}

public record PaymentIntentResult(string ClientSecret, string PaymentIntentId);
