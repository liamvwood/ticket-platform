using Stripe;

namespace TicketPlatform.Api.Services;

public class StripePaymentProvider(IConfiguration config) : IPaymentProvider
{
    public async Task<PaymentIntentResult> CreatePaymentIntentAsync(Guid orderId, decimal amount)
    {
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        var service = new PaymentIntentService();
        var intent = await service.CreateAsync(new PaymentIntentCreateOptions
        {
            Amount = (long)(amount * 100),
            Currency = "usd",
            Metadata = new Dictionary<string, string> { ["orderId"] = orderId.ToString() },
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions { Enabled = true }
        });
        return new PaymentIntentResult(intent.ClientSecret!, intent.Id);
    }
}
