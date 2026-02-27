namespace TicketPlatform.Api.Services;

public interface IPaymentProvider
{
    Task<PaymentIntentResult> CreatePaymentIntentAsync(Guid orderId, decimal amount);
}

public record PaymentIntentResult(string ClientSecret, string PaymentIntentId);
