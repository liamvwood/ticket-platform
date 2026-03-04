namespace TicketPlatform.Api.Models;

public record RegisterRequest(string Email, string Password, string PhoneNumber);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, string Email, string Role);
public record PhoneOtpRequest(string PhoneNumber);
public record PhoneVerifyRequest(string PhoneNumber, string Code);
public record OAuthCallbackRequest(string Provider, string Code, string RedirectUri, string? CodeVerifier);

public record CreateInviteRequest(string Email, string VenueName);
public record AcceptInviteRequest(string Password, string? PhoneNumber);

public record CreateEventRequest(
    Guid VenueId,
    string Name,
    string Description,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTimeOffset SaleStartsAt,
    string? RecurringRule = null);

public record CreateTicketTypeRequest(
    string Name,
    decimal Price,
    int TotalQuantity,
    int MaxPerOrder);

public record OrderLineItem(Guid TicketTypeId, int Quantity);

public record CreateOrderRequest(
    Guid TicketTypeId,
    int Quantity,
    decimal PlatformFee = 0m,
    List<OrderLineItem>? Items = null);

public record QrValidationRequest(string Token);

public record EventsPagedResult(
    List<TicketPlatform.Core.Entities.Event> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
