# Slingshot Ticket Platform — Copilot Instructions

Low-fee ticketing platform for local venues. .NET 10 API + Lit/TypeScript SPA + PostgreSQL.

## Build & Test Commands

```bash
# Activate the pre-push hook (one-time, per clone)
git config core.hooksPath .githooks

# Start the full local stack (DB + API + Vite frontend)
./scripts/dev.sh

# Start stack and run E2E tests
./scripts/dev.sh --test

# Kill all background processes
./scripts/dev.sh --stop

# Build API only
dotnet build src/TicketPlatform.Api/TicketPlatform.Api.csproj

# Add a migration (run from repo root)
export PATH="$PATH:$HOME/.dotnet/tools"
dotnet ef migrations add <MigrationName> \
  --project src/TicketPlatform.Infrastructure \
  --startup-project src/TicketPlatform.Api

# Run all E2E tests (requires stack running)
cd src/TicketPlatform.Web
E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://localhost:8080 npx playwright test

# Run a single E2E test by name
npx playwright test -g "register new user"

# Run a single test file
npx playwright test app.spec.ts

# Frontend dev server only (if API already running)
cd src/TicketPlatform.Web && VITE_API_URL=http://localhost:8080 npm run dev
```

**Important:** When launching the API process, always `cd` into the build output directory first so ASP.NET Core finds `appsettings.Development.json`:
```bash
cd /tmp/ticket-api-build && dotnet TicketPlatform.Api.dll
# NOT: dotnet /tmp/ticket-api-build/TicketPlatform.Api.dll (runs from wrong CWD)
```

## Architecture

```
TicketPlatform.Core/          # Entities & enums — no dependencies on other projects
TicketPlatform.Infrastructure/ # EF Core DbContext + migrations
TicketPlatform.Api/            # ASP.NET Core API (controllers, services, DTOs)
TicketPlatform.Web/            # Vite + Lit Web Components SPA
  src/
    app.ts                     # Root component + regex-based router
    pages/page-*.ts            # One file per page
    components/tp-*.ts         # Shared components (tp-button, tp-nav, tp-badge, tp-card)
    services/api.ts            # Typed fetch wrapper (40+ methods)
    services/auth.ts           # Auth state (localStorage) + navigate()
  e2e/app.spec.ts              # All Playwright E2E tests
```

**Data flow:** Browser → Vite dev server (`:5173`) → API (`:8080`) → PostgreSQL (`:5432`)  
**In production:** nginx serves the SPA and proxies `/og/*` to the API for OG meta tag server-rendering.

## Backend Conventions

### Controllers

All controllers are in `src/TicketPlatform.Api/Controllers/`. They use constructor injection via primary constructors:
```csharp
public class EventsController(AppDbContext db, AppMetrics metrics, IStorageService storage) : ControllerBase
```

Parse the caller's ID from claims like this:
```csharp
var callerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
```

Role checks: use `[Authorize(Roles = "VenueAdmin,AppOwner")]`. For ownership verification, check inside the action:
```csharp
if (!User.IsInRole("AppOwner") && ev.Venue?.OwnerId != callerId) return Forbid();
```

Roles in use: `User`, `VenueAdmin`, `Scanner`, `Guest`, `AppOwner`.

### DTOs

All request/response records live in one file: `src/TicketPlatform.Api/Models/Requests.cs`. Add new DTOs there as C# records:
```csharp
public record CreateEventRequest(Guid VenueId, string Name, DateTimeOffset StartsAt, ...);
```

Entities are in `TicketPlatform.Core/Entities/`. Never return entity objects directly from controllers — project to a DTO or anonymous object.

### Error Responses

Follow the existing convention for error responses:
- `400` — validation failure: `return BadRequest("Human-readable message.")`
- `409` — conflict (oversell, duplicate email): `return Conflict("...")`
- `404` — not found: `return NotFound()`
- `403` — wrong owner: `return Forbid()`

For structured errors (e.g., multiple fields): `return BadRequest(new { error = "...", field = "..." })`

The global exception handler in Program.cs catches unhandled exceptions and returns `{ "error": "An unexpected error occurred." }` — never leak stack traces.

### Rate Limiting

Applied via `[EnableRateLimiting("auth")]` or `[EnableRateLimiting("purchase")]`. Policies are defined in Program.cs. Add to any endpoint that could be abused.

### EF Core Patterns

- Use `Include`/`ThenInclude` for eager loading, not lazy loading.
- For ticket reservation, use raw SQL with `FOR UPDATE SKIP LOCKED` to avoid overselling.
- Wrap multi-step mutations in `await db.Database.BeginTransactionAsync()`.
- `TicketType` uses PostgreSQL `xmin` as an optimistic concurrency token (configured in `AppDbContext`).
- All decimal columns use `numeric(10,2)` — set this in `OnModelCreating`, not via attributes.

### Services

Swappable providers follow the `I{Name}Provider` interface pattern:
- `IPaymentProvider` → `MockPaymentProvider` (dev) / `StripePaymentProvider` (prod)
- `IOAuthProvider` → `MockOAuthProvider` / `GoogleOAuthProvider` / `GitHubOAuthProvider` / `FacebookOAuthProvider`
- `IOtpSender` → `MockOtpSender` / `TwilioOtpSender`

The active implementation is wired in Program.cs based on config (`Payment:Provider`, `OAuth:UseMock`, etc.). In dev, `Payment:Provider=Mock` auto-confirms orders after 10 seconds via `AutoConfirmOrdersService`.

### Prometheus Metrics

All business events are tracked via the `AppMetrics` singleton. Inject it and call:
```csharp
metrics.OrdersCreatedTotal.WithLabels("pending").Inc();
```
Metrics are exposed at `/metrics` (internal access only — bound to `*:8080`, not through public ingress).

## Frontend Conventions

### Lit Components

All components extend `LitElement`. Use decorators throughout:
```typescript
@customElement('page-events')
export class PageEvents extends LitElement {
  static styles = css` :host { display: block; } `;

  @state() private _events: Event[] = [];   // private reactive state
  @property() public venueId?: string;       // public attribute/property

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }
}
```

- `@state()` = private reactive state, prefix with `_`
- `@property()` = public, bindable from parent
- `.prop=${val}` for property binding; `attr="${val}"` for HTML attribute binding
- CSS is scoped to shadow DOM — no global styles leak in or out

### Router

The router lives entirely in `app.ts` as an array of `{ pattern: RegExp, render: fn }` routes. To add a route, append to that array. Navigation uses `navigate()` from `services/auth.ts`:
```typescript
navigate('/events');  // calls history.pushState + fires popstate
```

### API Calls

Use the `api` object from `services/api.ts` — never call `fetch` directly in components:
```typescript
import { api } from '../services/api.js';
const result = await api.getEvents({ tab: 'upcoming', hot: true });
```

The wrapper auto-injects `Authorization: Bearer <token>` from localStorage and throws a typed `Error` with the server's error message on non-2xx responses. For multipart uploads, use `requestRaw()`.

### Auth State

Read/write auth state only through `services/auth.ts`:
```typescript
auth.isLoggedIn         // boolean
auth.role               // 'User' | 'VenueAdmin' | 'AppOwner' | null
auth.save(token, email, role)   // persists to localStorage + fires 'auth-change' event
auth.logout()           // clears localStorage + navigates to /
```

Listen to `window.dispatchEvent(new CustomEvent('auth-change'))` to react to login/logout in other components.

## E2E Test Conventions

Tests live in `src/TicketPlatform.Web/e2e/app.spec.ts`. All tests share pre-seeded users:
- Buyer: `e2ebuyer@slingshot.dev` / `Password123!`
- VenueAdmin: `venue@slingshot.dev` / `Password123!`
- AppOwner: `owner@slingshot.dev` / `ChangeMe123!`

For test isolation, suffix unique identifiers with `RUN = Date.now().toString().slice(-6)`. Use the `apiPost/apiGet/getToken` helpers (defined at the top of the test file) for API-driven setup/teardown — don't repeat UI login flows when you only need a token. Clean up created resources in `afterEach` using the AppOwner token.

Inject auth directly into `localStorage` rather than going through the login UI:
```typescript
await page.evaluate(({ token, email, role }) => {
  localStorage.setItem('jwt', token);
  localStorage.setItem('userEmail', email);
  localStorage.setItem('userRole', role);
}, { token, email: VENUE_EMAIL, role: 'VenueAdmin' });
```

## Configuration

The API uses `appsettings.{Environment}.json`. The key dev settings are in `appsettings.Development.json`:
- `AppOwner:Email` / `AppOwner:Password` — seeds the AppOwner on startup
- `Payment:Provider` — `Mock` or `Stripe`
- `OAuth:UseMock` — `true` bypasses real OAuth
- `Otp:Provider` — `Mock` or `Twilio`

The base `appsettings.json` intentionally has empty values for secrets — Development overrides supply them.

Environment variables override any `appsettings.json` key using the `__` separator:
```bash
ConnectionStrings__DefaultConnection="Host=localhost;..."
Payment__Provider=Mock
```
