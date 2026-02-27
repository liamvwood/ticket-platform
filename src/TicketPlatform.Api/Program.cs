using System.Threading.RateLimiting;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TicketPlatform.Api.Services;
using TicketPlatform.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:4173")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<QrTokenService>();

var paymentProvider = builder.Configuration["Payment:Provider"];
if (string.Equals(paymentProvider, "Mock", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IPaymentProvider, MockPaymentProvider>();
else
    builder.Services.AddScoped<IPaymentProvider, StripePaymentProvider>();

var otpProvider = builder.Configuration["Otp:Provider"];
if (string.Equals(otpProvider, "Mock", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IOtpSender, MockOtpSender>();
else
    builder.Services.AddScoped<IOtpSender, TwilioOtpSender>();

// OAuth providers — always register all; mock endpoint only active when OAuth:UseMock=true
builder.Services.AddHttpClient();
builder.Services.AddSingleton<MockOAuthProvider>();
builder.Services.AddTransient<IOAuthProvider, MockOAuthProvider>(sp => sp.GetRequiredService<MockOAuthProvider>());
builder.Services.AddTransient<IOAuthProvider, GoogleOAuthProvider>();
builder.Services.AddTransient<IOAuthProvider, GitHubOAuthProvider>();
builder.Services.AddTransient<IOAuthProvider, FacebookOAuthProvider>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtConfig = builder.Configuration.GetSection("Jwt");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtConfig["Issuer"],
            ValidAudience = jwtConfig["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig["Secret"]!))
        };
    });

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("purchase", o =>
    {
        o.Window = TimeSpan.FromMinutes(1);
        o.PermitLimit = 20;
        o.QueueLimit = 0;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("frontend");
app.UseHttpsRedirection();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/healthz", () => Results.Ok(new { status = "healthy" }));

// Seed AppOwner on startup (idempotent upsert)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TicketPlatform.Infrastructure.Data.AppDbContext>();
    var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var ownerEmail = cfg["AppOwner:Email"];
    var ownerPassword = cfg["AppOwner:Password"];
    if (!string.IsNullOrWhiteSpace(ownerEmail) && !string.IsNullOrWhiteSpace(ownerPassword))
    {
        var normalizedEmail = ownerEmail.ToLowerInvariant();
        var existing = db.Users.FirstOrDefault(u => u.Email == normalizedEmail);
        if (existing is null)
        {
            var ownerId = Guid.NewGuid();
            db.Users.Add(new TicketPlatform.Core.Entities.User
            {
                Id = ownerId,
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(ownerPassword),
                Role = "AppOwner",
                ReferralCode = TicketPlatform.Api.Services.SlugHelper.GenerateReferralCode(ownerId),
            });
            db.SaveChanges();
        }
        else if (existing.Role != "AppOwner")
        {
            existing.Role = "AppOwner";
            db.SaveChanges();
        }
    }
}

app.Run();
