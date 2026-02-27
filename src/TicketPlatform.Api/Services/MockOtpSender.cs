namespace TicketPlatform.Api.Services;

/// <summary>
/// No-op OTP sender for local development and testing.
/// The generated code is returned in the API response instead of being sent via SMS.
/// Never register this provider in production.
/// </summary>
public class MockOtpSender : IOtpSender
{
    public Task SendAsync(string phoneNumber, string code)
    {
        // Code is surfaced in the API response body when MockOtpSender is active.
        return Task.CompletedTask;
    }
}
