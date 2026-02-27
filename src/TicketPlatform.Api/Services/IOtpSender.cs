namespace TicketPlatform.Api.Services;

public interface IOtpSender
{
    /// <summary>Sends a one-time passcode to the given phone number.</summary>
    Task SendAsync(string phoneNumber, string code);
}
