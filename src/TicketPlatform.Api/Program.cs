using StackExchange.Redis;
using System.Threading.RateLimiting;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Prometheus;
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

var corsAllowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy
            .SetIsOriginAllowed(origin =>
            {
                var uri = new Uri(origin);
                return uri.Host == "localhost"
                    || uri.Host == "127.0.0.1"
                    || uri.Host.EndsWith(".app.github.dev")
                    || uri.Host.EndsWith(".sslip.io")
                    || corsAllowedOrigins.Any(h => uri.Host == h || uri.Host.EndsWith("." + h));
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<QrTokenService>();
builder.Services.AddSingleton<AppMetrics>();
builder.Services.AddSingleton<IStorageService, S3StorageService>();

var paymentProvider = builder.Configuration["Payment:Provider"];
if (string.Equals(paymentProvider, "Mock", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IPaymentProvider, MockPaymentProvider>();
    builder.Services.AddHostedService<AutoConfirmOrdersService>();
}
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
    // Protect auth endpoints from brute force
    options.AddFixedWindowLimiter("auth", o =>
    {
        o.Window = TimeSpan.FromMinutes(1);
        o.PermitLimit = 10;
        o.QueueLimit = 0;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    // Extra-strict limit on OTP requests (allow more per window for E2E test runs)
    options.AddFixedWindowLimiter("otp", o =>
    {
        o.Window = TimeSpan.FromMinutes(10);
        o.PermitLimit = 20;
        o.QueueLimit = 0;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
});

// Redis for hotness tracking (optional — falls back gracefully if not configured)
var redisConn = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConn))
{
    builder.Services.AddSingleton<IConnectionMultiplexer>(
        ConnectionMultiplexer.Connect(redisConn));
}

var app = builder.Build();

// Global exception handler — always return clean JSON, never leak stack traces
app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    var feature = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    var ex = feature?.Error;
    // Log full details server-side
    var logger = ctx.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
    await ctx.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred. Please try again." });
}));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("frontend");
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

// Security headers
var isDev = app.Environment.IsDevelopment();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (!isDev)
        ctx.Response.Headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
    await next();
});
app.UseRateLimiter();
app.UseRouting();
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
// Restrict metrics to internal cluster access only (not exposed via public ingress)
app.MapMetrics("/metrics").RequireHost("*:8080");
app.MapGet("/healthz", () => Results.Ok(new { status = "healthy" }));

// Apply any pending EF Core migrations on startup (safe to run multiple times)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TicketPlatform.Infrastructure.Data.AppDbContext>();
    db.Database.Migrate();
}

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

// Seed test venue in Development/Test (idempotent — used by E2E tests)
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<TicketPlatform.Infrastructure.Data.AppDbContext>();
    var testVenueId = Guid.Parse("a0000000-0000-0000-0000-000000000001");
    if (!db.Venues.Any(v => v.Id == testVenueId))
    {
        db.Venues.Add(new TicketPlatform.Core.Entities.Venue
        {
            Id = testVenueId,
            Name = "Stubb's Waller Creek",
            Address = "801 Red River St",
            City = "Austin",
            State = "TX",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
    }
}

app.Run();
