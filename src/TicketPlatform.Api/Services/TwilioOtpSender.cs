namespace TicketPlatform.Api.Services;

/// <summary>Sends OTP codes via Twilio SMS for production use.</summary>
public class TwilioOtpSender(IConfiguration config) : IOtpSender
{
    public async Task SendAsync(string phoneNumber, string code)
    {
        var accountSid = config["Twilio:AccountSid"]!;
        var authToken = config["Twilio:AuthToken"]!;
        var fromNumber = config["Twilio:FromNumber"]!;

        var credentials = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{accountSid}:{authToken}"));

        using var http = new HttpClient();
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);

        var body = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["To"] = phoneNumber,
            ["From"] = fromNumber,
            ["Body"] = $"Your Austin Tickets code: {code}. Valid for 5 minutes."
        });

        var res = await http.PostAsync(
            $"https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json", body);

        res.EnsureSuccessStatusCode();
    }
}
