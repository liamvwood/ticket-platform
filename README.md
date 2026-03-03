# 🎟 Austin Tickets

> Austin's local ticketing platform — zero fees, no crashes, no bots.

A full-stack ticketing platform built for Austin, TX venues. Competes with Ticketmaster and StubHub on fees, reliability, and experience. Built with AI-assisted development using GitHub Copilot CLI.

---

## ✨ Features

### For Fans
- **Browse & buy tickets** — event listings with live availability
- **Anonymous checkout** — buy with just a phone number + OTP, no account needed
- **Zero platform fees** — 100% of ticket revenue goes directly to the venue; fans can optionally add a voluntary $1–$5 contribution to keep the lights on
- **QR ticket delivery** — unique signed QR codes issued after payment
- **My Tickets** — polished physical-ticket card UI with live QR codes, filter tabs (Upcoming / Past / All), and checked-in overlay
- **Share events** — native share sheet on mobile, clipboard fallback on desktop; share links include referral tracking
- **Add to Calendar / Reminders** — generates a downloadable `.ics` file with 1-hour and 1-day VALARM reminders
- **Digital Wallet** — fullscreen QR modal with Apple Wallet and Google Calendar CTAs

### For Venues
- **Venue portal** — create events, manage ticket types (add / remove), set quantities and per-order limits
- **Publish/unpublish** — control when events go live
- **QR scanner app** — mobile-friendly camera-based scanner with instant Valid / Duplicate / Invalid / Refunded status
- **Referral attribution** — see which orders came from word-of-mouth referral links

### Platform
- **Event slugs** — human-readable URLs (`/events/black-pumas-stubbs-a1b2c3d4`) instead of UUIDs
- **Open Graph previews** — rich link previews in Slack, iMessage, Discord, Twitter/X with dynamic SVG images
- **Referral codes** — every user gets a unique code; `?ref=code` on share links is attributed on orders
- **Anti-scalping** — per-order ticket limits, identity binding, short-lived rotating QR tokens, rate limiting
- **Drop-ready** — optimistic concurrency + row-level locking to prevent overselling under load
- **Reverse proxy** — nginx in front of frontend and API for rate limiting and DDoS mitigation
- **Observability** — Prometheus metrics exported from the API; four Grafana dashboards (API requests, outbound HTTP, cluster resources, business metrics)
- **Favicon** — purple gradient ticket SVG icon

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│             Frontend (Vite + Lit Web Components)     │
│   Customer website · Venue portal · QR scanner app  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / JSON
┌──────────────────────▼──────────────────────────────┐
│           nginx reverse proxy  (rate limit / DDoS)  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              .NET 10 Web API  (stateless)            │
│  Auth · Events · Orders · Payments · Check-in · OG  │
│  Prometheus /metrics endpoint                       │
└──────────────────────┬──────────────────────────────┘
                       │ EF Core
┌──────────────────────▼──────────────────────────────┐
│             PostgreSQL 16                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Prometheus → Grafana (cluster + API dashboards)    │
└─────────────────────────────────────────────────────┘
```

**Local / CI:** Docker Compose  
**Production:** Helm chart on Amazon EKS (Kubernetes 1.31, t3.small nodes, us-east-1)

---

## 🗄 Data Model

| Entity | Key fields |
|--------|-----------|
| `User` | Email, PhoneNumber, PasswordHash, Role, PhoneVerified, **ReferralCode** |
| `Venue` | Name, Address, ContactEmail |
| `Event` | Name, **Slug**, Description, StartsAt, EndsAt, SaleStartsAt, IsPublished |
| `TicketType` | Name, Price, TotalQuantity, MaxPerOrder, QuantitySold |
| `Ticket` | Status, QrToken, QrTokenExpiresAt, OrderId |
| `Order` | Status, TotalAmount, **PlatformFee**, **ReferredBy**, StripePaymentIntentId, ExpiresAt |
| `Payment` | Amount, Status, StripePaymentIntentId |
| `CheckIn` | CheckedInAt, CheckedInBy |
| `PhoneVerification` | PhoneNumber, Code, Attempts, Used, ExpiresAt |

---

## 🔌 API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register with email + password |
| `POST` | `/auth/login` | Login, returns JWT |
| `POST` | `/auth/phone/request-otp` | Send 6-digit OTP to phone (guest checkout) |
| `POST` | `/auth/phone/verify-otp` | Verify OTP, upsert Guest user, return JWT |
| `GET`  | `/users/me/referrals` | Your referral code + attributed order count |

### Events
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/events` | List published events |
| `GET`  | `/events/{idOrSlug}` | Get event by UUID **or slug** |
| `POST` | `/events` | Create event *(VenueAdmin)* |
| `PUT`  | `/events/{id}/publish` | Publish event *(VenueAdmin)* |
| `POST` | `/events/{id}/ticket-types` | Add ticket type *(VenueAdmin)* |
| `DELETE` | `/events/{id}/ticket-types/{ttId}` | Remove ticket type *(VenueAdmin)* |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/orders?ref={code}` | Create order + lock tickets; optional referral code |
| `GET`  | `/orders` | My orders |
| `GET`  | `/orders/{id}` | Order detail |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/payments/orders/{id}/checkout` | Create PaymentIntent |
| `POST` | `/payments/orders/{id}/mock-confirm` | Simulate payment success *(mock provider only)* |
| `POST` | `/webhooks/stripe` | Stripe webhook handler |

### Check-in
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/checkin/validate` | Validate QR token *(Scanner role)* |

### Open Graph
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/og/events/{id}` | OG + Twitter Card meta HTML for link previews |
| `GET`  | `/og/events/{id}/image` | Dynamic 1200×630 SVG image |

---

## 💳 Payment Providers

Configured via `Payment:Provider`:

| Value | When to use |
|-------|------------|
| `Mock` | Local dev + tests — returns `mock_pi_*` IDs instantly, no Stripe account needed |
| `Stripe` | Production — real PaymentIntents via Stripe API |

### Voluntary Platform Fee
Revenue flows **directly from customer to venue** — zero platform fees by default. During checkout, fans can optionally add a **$0 / $1 / $2 / $3 / $5** contribution. The fee is stored on the order and included in the payment total.

---

## 📱 OTP / SMS Providers

Configured via `Otp:Provider`:

| Value | When to use |
|-------|------------|
| `Mock` | Local dev + tests — returns the code in the API response as `devCode` (never in production) |
| `Twilio` | Production — sends real SMS via Twilio REST API |

---

## 🔗 Viral Sharing

1. **Slug URLs** — every event gets a readable URL on creation (e.g. `/events/black-pumas-stubbs-a1b2c3d4`)
2. **Share button** — `navigator.share()` on mobile; clipboard copy + toast on desktop
3. **Pre-filled share text** — `🎟 Event Name — Date @ Venue | austintickets.dev/events/slug`
4. **OG previews** — `GET /og/events/{id}` serves full OG + Twitter Card meta; rich cards in Slack, iMessage, Discord
5. **Dynamic OG image** — deterministic gradient SVG per event (no external image service)
6. **Referral links** — `?ref={code}` appended to share URLs; code stored on the resulting order

---

## 🔒 Security

- JWT authentication (HS256, 24h expiry)
- Roles: `User`, `VenueAdmin`, `Scanner`, `Guest`
- Signed QR tokens (HMAC-SHA256), expire 1 hour after event ends
- OTP rate limiting: max 3 codes per phone per 10 minutes; 5-attempt lockout per code
- Order rate limiting: fixed-window middleware on purchase endpoint
- Row-level locking (`FOR UPDATE SKIP LOCKED`) prevents overselling under concurrent load
- Optimistic concurrency (`xmin` on `TicketType`) as EF Core concurrency token
- nginx reverse proxy with `limit_req_zone` rate limiting on the ingress layer
- Server-side errors are caught and normalized — stack traces never reach the frontend
- `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` security headers set on all API responses

---

## 🧪 Testing

60 Playwright E2E tests covering all major flows:

```bash
cd src/TicketPlatform.Web
npm run test:e2e
```

| Test group | Scenarios |
|------------|-----------|
| Home page | Hero render, CTAs |
| Authentication | Register, login, logout, wrong password |
| Events page | Live events, demo fallback, card navigation |
| Venue admin flow | Create event, add/remove ticket types, publish |
| Purchase flow | Reserve → checkout → mock-confirm → Paid status |
| Guest OTP checkout | request-otp devCode, verify-otp → Guest JWT, place order, wrong code |
| Platform fee | Zero fee, custom fee ($2), fee clamping (>$20 → $20) |
| My Tickets | Auth guard redirect, order list |
| Scanner | Auth warning, VenueAdmin UI, token validation |
| Event slugs | Slug present on events, slug lookup, OG HTML, OG SVG image |
| Referral codes | Code generated on register, referral count endpoint |
| Navigation | Brand, Events, Login links |
| OAuth mock login | OAuth callback flow |
| Venue invite flow | Admin creates invite, venue accepts, venue can create events |
| VenueAdmin lockdown | Unauthenticated access blocked |
| API health | `/healthz` |

---

## 📊 Observability

Prometheus metrics are scraped from the API's `/metrics` endpoint and visualised in Grafana.

| Dashboard | Panels |
|-----------|--------|
| **API Requests** | Request rate, error rate (5xx), p50/p95/p99 latency by endpoint |
| **Outbound HTTP** | External call rate + latency (Stripe, Twilio, etc.) |
| **Cluster Resources** | Node CPU & memory usage, pod counts |
| **Business Metrics** | Orders per hour, tickets sold, platform fee collected |

**Grafana access (test ring):**  
URL: `https://grafana.100.29.51.191.sslip.io`  
Default credentials are in the Helm `values-test.yaml` (not committed — set via Kubernetes secret).

---

## 🚀 CI/CD Pipeline

Every push to `main` triggers the **CI/CD – Test Ring** GitHub Actions workflow:

| Stage | What happens |
|-------|-------------|
| **Build & Test** | `dotnet build` + `dotnet test` (unit); `npm run build` + `npm test`; Playwright E2E against local API+frontend |
| **Build & Push images** | Docker builds API + frontend images; pushed to Amazon ECR |
| **Deploy to Test EKS** | `helm upgrade --install` on the `ticket-platform-test` EKS cluster (us-east-1) |
| **Smoke tests** | `curl` healthz + homepage reachability check against the live cluster |
| **E2E on EKS** | Full 60-test Playwright suite against `https://app.100.29.51.191.sslip.io` |

**Test ring URLs:**
| Service | URL |
|---------|-----|
| Frontend | `https://app.100.29.51.191.sslip.io` |
| API | `https://api.100.29.51.191.sslip.io` |
| Health | `https://api.100.29.51.191.sslip.io/healthz` |
| Grafana | `https://grafana.100.29.51.191.sslip.io` |

---

## 🏁 Getting Started

### Prerequisites
- Docker + Docker Compose
- .NET 10 SDK
- Node.js 20+

### Local Development

```bash
# 1. Start database + API
docker compose up -d

# 2. Apply migrations
cd src/TicketPlatform.Api
dotnet ef database update --project ../TicketPlatform.Infrastructure

# 3. Seed test venue (required for E2E)
psql postgresql://postgres:postgres@localhost:5432/ticketplatform -c "
INSERT INTO \"Venues\" (\"Id\",\"Name\",\"Address\",\"ContactEmail\",\"CreatedAt\")
VALUES ('a0000000-0000-0000-0000-000000000001',
        'Stubb''s Waller Creek','801 Red River St','hello@stubbs.com',now())
ON CONFLICT DO NOTHING;"

# 4. Start frontend
cd ../TicketPlatform.Web
npm install
npm run dev
```

| URL | Service |
|-----|---------|
| http://localhost:5173 | Frontend |
| http://localhost:8080 | API |
| http://localhost:8080/healthz | Health check |

### Configuration

Local defaults (`appsettings.Development.json` + `docker-compose.yml`):
- `Payment:Provider = "Mock"` — no Stripe account needed
- `Otp:Provider = "Mock"` — OTP codes returned in API response as `devCode`

Production environment variables:
```env
Payment__Provider=Stripe
Stripe__SecretKey=sk_live_...
Stripe__WebhookSecret=whsec_...
Otp__Provider=Twilio
Twilio__AccountSid=AC...
Twilio__AuthToken=...
Twilio__FromNumber=+15125550100
Jwt__Secret=<min-32-char-secret>
ConnectionStrings__DefaultConnection=Host=...
```

---

## 📁 Project Structure

```
ticket-platform/
├── src/
│   ├── TicketPlatform.Api/              # .NET 10 Web API
│   │   ├── Controllers/
│   │   │   ├── AuthController.cs        # Register, login, phone OTP, referrals
│   │   │   ├── EventsController.cs      # Event + ticket type CRUD
│   │   │   ├── OrdersController.cs      # Order creation + listing
│   │   │   ├── PaymentsController.cs    # Checkout, mock-confirm, Stripe webhook
│   │   │   ├── CheckInController.cs     # QR token validation
│   │   │   └── OgController.cs          # Open Graph preview + SVG image
│   │   ├── Services/
│   │   │   ├── TokenService.cs          # JWT generation
│   │   │   ├── QrTokenService.cs        # HMAC QR token generation
│   │   │   ├── SlugHelper.cs            # Slug + referral code generation
│   │   │   ├── IPaymentProvider.cs      # Payment abstraction
│   │   │   ├── MockPaymentProvider.cs   # Local dev payment mock
│   │   │   ├── StripePaymentProvider.cs # Production Stripe
│   │   │   ├── IOtpSender.cs            # OTP abstraction
│   │   │   ├── MockOtpSender.cs         # Local dev OTP mock
│   │   │   └── TwilioOtpSender.cs       # Production Twilio SMS
│   │   └── Models/Requests.cs
│   ├── TicketPlatform.Core/             # Domain entities + enums
│   ├── TicketPlatform.Infrastructure/
│   │   └── Data/                        # AppDbContext + EF Core migrations
│   └── TicketPlatform.Web/              # Vite + Lit Web Components SPA
│       ├── src/
│       │   ├── pages/                   # page-home, page-events, page-event-detail,
│       │   │                            #   page-checkout, page-my-tickets, page-auth,
│       │   │                            #   page-venue-dashboard, page-venue-new-event,
│       │   │                            #   page-scanner, page-admin-invites,
│       │   │                            #   page-invite-accept, page-oauth-callback
│       │   ├── components/tp-nav.ts
│       │   └── services/                # api.ts, auth.ts, icons.ts
│       ├── public/favicon.svg           # Purple gradient ticket icon
│       ├── e2e/app.spec.ts              # 60 Playwright E2E tests
│       └── playwright.config.ts
├── helm/                                # Kubernetes Helm chart
│   ├── templates/                       # Deployment, Service, Ingress, HPA,
│   │                                    #   ServiceMonitor (Prometheus scrape)
│   ├── dashboards/                      # Grafana dashboard JSON (4 dashboards)
│   ├── values.yaml
│   └── values-test.yaml                 # Test ring overrides
├── .github/workflows/deploy.yml         # CI/CD – Test Ring pipeline
├── Dockerfile
├── Dockerfile.frontend
├── nginx.conf                           # Reverse proxy config
└── docker-compose.yml
```

---

## 🗺 Roadmap

### Built ✅
- .NET 10 Web API with full event/order/payment/check-in CRUD
- JWT auth with role-based access (User, VenueAdmin, Scanner, Guest)
- Pessimistic locking purchase flow (no overselling)
- Stripe payment integration + mock provider for local dev
- QR token generation + check-in validation
- Web Components SPA (customer website, venue portal, scanner)
- Docker Compose + Helm chart on Amazon EKS
- Anonymous guest checkout (phone + OTP, mock + Twilio)
- Zero platform fees with voluntary fan contribution UI
- Human-readable event slugs
- Social share button (Web Share API + clipboard)
- Open Graph preview endpoint + dynamic SVG images
- Referral code tracking and attribution
- My Tickets — physical ticket card UI, real QR codes, calendar export, wallet modal
- Venue invite flow — owner-only invite system with one-time accept links
- Owner event creation UI — create events, manage ticket types from the frontend
- nginx reverse proxy — rate limiting and DDoS mitigation
- Security headers — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`; server errors never surface to frontend
- Prometheus metrics + four Grafana dashboards (API requests, outbound HTTP, cluster resources, business metrics)
- GitHub Actions CI/CD pipeline — build → test → ECR push → EKS deploy → E2E smoke suite
- 60 Playwright E2E tests (full CI + EKS ring coverage)
- Favicon — purple gradient ticket SVG icon

### Planned 🔜
- [ ] Venue payout system (Stripe Connect)
- [ ] Virtual queue / waiting room for high-demand drops
- [ ] Venue analytics dashboard (sales, referral breakdown by event)
- [ ] Email notifications (order confirmation, event reminders)
- [ ] ML-based scalping detection

---

## 🏛 Principles

| Principle | How |
|-----------|-----|
| **Drop-ready reliability** | Row-level locking, stateless API, horizontal scaling |
| **Zero fees by default** | Direct venue-to-fan revenue; voluntary contribution model |
| **No bots / anti-scalping** | Per-order limits, phone-bound identity, rotating QR tokens |
| **Austin-first** | Local branding, direct venue relationships, community focus |
| **AI-accelerated** | Built with GitHub Copilot CLI + screenshot feedback loops |
