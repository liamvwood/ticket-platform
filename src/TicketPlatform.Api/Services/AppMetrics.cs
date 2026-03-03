using Prometheus;

namespace TicketPlatform.Api.Services;

/// <summary>
/// Central registry for all custom Prometheus metrics emitted by the API.
/// Covers inbound HTTP (via UseHttpMetrics), outbound HTTP client calls,
/// and key business events (orders, payments, auth, OTP).
/// </summary>
public sealed class AppMetrics
{
    // ── Business: Orders ──────────────────────────────────────────────────
    public readonly Counter OrdersCreatedTotal = Metrics.CreateCounter(
        "ticketplatform_orders_created_total",
        "Total orders created",
        new CounterConfiguration { LabelNames = ["status"] });

    public readonly Counter TicketsReservedTotal = Metrics.CreateCounter(
        "ticketplatform_tickets_reserved_total",
        "Total tickets reserved (locked into an order)");

    // ── Business: Payments ────────────────────────────────────────────────
    public readonly Counter PaymentsTotal = Metrics.CreateCounter(
        "ticketplatform_payments_total",
        "Total payment operations",
        new CounterConfiguration { LabelNames = ["outcome"] }); // confirmed | failed | expired

    // ── Business: Auth & OTP ──────────────────────────────────────────────
    public readonly Counter AuthTotal = Metrics.CreateCounter(
        "ticketplatform_auth_total",
        "Authentication attempts",
        new CounterConfiguration { LabelNames = ["method", "outcome"] }); // login/register/otp, success/failure

    public readonly Counter OtpRequestsTotal = Metrics.CreateCounter(
        "ticketplatform_otp_requests_total",
        "OTP codes requested");

    public readonly Counter OtpVerificationsTotal = Metrics.CreateCounter(
        "ticketplatform_otp_verifications_total",
        "OTP verification attempts",
        new CounterConfiguration { LabelNames = ["outcome"] }); // success | wrong_code | expired

    // ── Business: Events ──────────────────────────────────────────────────
    public readonly Counter EventsCreatedTotal = Metrics.CreateCounter(
        "ticketplatform_events_created_total",
        "Total events created");

    public readonly Counter EventsPublishedTotal = Metrics.CreateCounter(
        "ticketplatform_events_published_total",
        "Total events published");

    // ── Outbound HTTP ─────────────────────────────────────────────────────
    public readonly Counter OutboundRequestsTotal = Metrics.CreateCounter(
        "ticketplatform_outbound_requests_total",
        "Total outbound HTTP requests from the API",
        new CounterConfiguration { LabelNames = ["service", "outcome"] }); // twilio/stripe/oauth, success|failure

    public readonly Histogram OutboundRequestDuration = Metrics.CreateHistogram(
        "ticketplatform_outbound_request_duration_seconds",
        "Duration of outbound HTTP requests",
        new HistogramConfiguration
        {
            LabelNames = ["service"],
            Buckets = Histogram.ExponentialBuckets(0.05, 2, 8)
        });
}
