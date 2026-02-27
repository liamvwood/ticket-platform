namespace TicketPlatform.Api.Models;

public record RegisterRequest(string Email, string Password, string PhoneNumber);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, string Email, string Role);
public record PhoneOtpRequest(string PhoneNumber);
public record PhoneVerifyRequest(string PhoneNumber, string Code);

public record CreateEventRequest(
    Guid VenueId,
    string Name,
    string Description,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTimeOffset SaleStartsAt);

public record CreateTicketTypeRequest(
    string Name,
    decimal Price,
    int TotalQuantity,
    int MaxPerOrder);

public record CreateOrderRequest(
    Guid TicketTypeId,
    int Quantity,
    decimal PlatformFee = 0m);

public record QrValidationRequest(string Token);
