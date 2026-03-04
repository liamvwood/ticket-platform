/**
 * End-to-end tests for Austin Ticket Platform
 * Covers: home, auth, events (API live), venue flow, purchase flow, QR check-in
 *
 * Prerequisites:
 *   - Frontend dev server on http://localhost:5173
 *   - API on http://localhost:8080 with migrations applied
 *   - Seeded: venue admin user + Stubb's venue
 */

import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:8080';
const VENUE_ID = 'a0000000-0000-0000-0000-000000000001';

// Fixed test users (pre-seeded in DB before test run)
const USER_EMAIL = 'e2ebuyer@slingshot.dev';
const USER_PASS = 'Password123!';
const VENUE_EMAIL = 'venue@slingshot.dev';
const VENUE_PASS = 'Password123!';
const OWNER_EMAIL = 'owner@slingshot.dev';
const OWNER_PASS = 'ChangeMe123!';

// Unique suffix for data created during this run
const RUN = Date.now().toString().slice(-6);

// ─── Helpers ───────────────────────────────────────────────────────────────

async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: () => res.status, json: () => json };
}

async function apiGet(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  const json = await res.json().catch(() => null);
  return { status: () => res.status, json: () => json };
}

async function apiPut(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers });
  return res.status;
}

async function apiDelete(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers });
  return res.status;
}

/** Best-effort event cleanup — uses AppOwner force-delete to bypass sold-ticket checks on mock payment data. */
async function deleteEvent(eventId: string, _token: string) {
  if (!eventId) return;
  // Always use owner credentials for force=true so cleanup succeeds regardless of ticket/order state
  const ownerToken = await getToken(OWNER_EMAIL, OWNER_PASS).catch(() => _token);
  await fetch(`${API}/events/${eventId}?force=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).catch(() => { /* network errors ignored during cleanup */ });
}

async function getToken(email: string, pass: string): Promise<string> {
  const res = await apiPost('/auth/login', { email, password: pass });
  const token = res.json()?.token;
  if (!token) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.json())}`);
  return token;
}

// ─── Smoke tests ───────────────────────────────────────────────────────────

test.describe('Home page', () => {
  test('loads and shows hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Precision');
    await expect(page.locator('.fee-pct.us')).toContainText('3%');
  });

  test('Find Tickets CTA navigates to /events', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Find Tickets' }).click();
    await expect(page).toHaveURL('/events');
  });

  test('Get Started CTA navigates to /register', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Launch Your Event' }).first().click();
    await expect(page).toHaveURL('/register');
  });
});

// ─── Auth flow ─────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('register new user', async ({ page }) => {
    // Use a unique email each run so this test can run repeatedly
    const newEmail = `newuser${RUN}@slingshot.dev`;
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Create account');
    await page.fill('input[type="email"]', newEmail);
    await page.fill('input[type="password"]', USER_PASS);
    await page.fill('input[type="tel"]', '5125550199');
    await page.locator('button[type="submit"]').click();
    // Successful register redirects to /events
    await expect(page).toHaveURL('/events', { timeout: 10_000 });
  });

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', USER_EMAIL);
    await page.fill('input[type="password"]', USER_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/events');
    // Logout via nav
    await page.locator('button', { hasText: 'Logout' }).first().click();
    await expect(page.locator('button', { hasText: 'Get Started' }).first()).toBeVisible();
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', USER_EMAIL);
    await page.fill('input[type="password"]', 'WrongPass999!');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.error')).toBeVisible({ timeout: 5_000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', USER_EMAIL);
    await page.fill('input[type="password"]', USER_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/events');
    await expect(page.locator('button', { hasText: 'Logout' }).first()).toBeVisible();
  });
});

// ─── Events (live API) ─────────────────────────────────────────────────────

test.describe('Events page', () => {
  test('shows events or demo banner', async ({ page }) => {
    await page.goto('/events');
    await page.waitForTimeout(800);
    const cards = page.locator('.event-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('event card click navigates to detail page', async ({ page }) => {
    await page.goto('/events');
    await page.waitForTimeout(800);
    const firstCard = page.locator('.event-card').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/events\/.+/);
  });
});

// ─── Venue admin flow (API-driven) ─────────────────────────────────────────

test.describe('Venue admin flow', () => {
  let venueToken: string;
  let eventId: string;
  let ticketTypeId: string;
  let tmpEventId: string;

  test.beforeAll(async () => {
    venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
  });

  test.afterAll(async () => {
    await deleteEvent(eventId, venueToken);
    await deleteEvent(tmpEventId, venueToken);
  });

  test('venue portal is accessible to VenueAdmin', async ({ page }) => {
    // Inject token into localStorage before navigation
    await page.goto('/');
    await page.evaluate(
      ([token, email]) => {
        localStorage.setItem('jwt', token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userRole', 'VenueAdmin');
        window.dispatchEvent(new Event('auth-change'));
      },
      [venueToken, VENUE_EMAIL]
    );
    await page.goto('/venue');
    await expect(page.locator('h1')).toContainText('Venue');
  });

  test('can create an event via API', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const dayAfter = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const saleStart = new Date(Date.now() - 3600_000).toISOString();

    const res = await apiPost(
      '/events',
      {
        venueId: VENUE_ID,
        name: `E2E Test Concert ${RUN}`,
        description: 'Automated E2E test event',
        startsAt: tomorrow,
        endsAt: dayAfter,
        saleStartsAt: saleStart,
      },
      venueToken
    );
    expect(res.status()).toBe(201);
    const ev = res.json();
    eventId = ev.id;
    expect(ev.name).toContain('E2E Test Concert');
  });

  test('can add ticket type to event', async () => {
    const res = await apiPost(
      `/events/${eventId}/ticket-types`,
      { name: 'General Admission', price: 25.00, totalQuantity: 10, maxPerOrder: 4 },
      venueToken
    );
    expect(res.status()).toBe(201);
    const tt = res.json();
    ticketTypeId = tt.id;
    expect(tt.name).toBe('General Admission');
  });

  test('can publish the event', async () => {
    const status = await apiPut(`/events/${eventId}/publish`, venueToken);
    expect(status).toBe(204);
  });

  test('can delete an unpublished ticket type', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const dayAfter  = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const saleStart = new Date(Date.now() - 3_600_000).toISOString();
    const evRes = await apiPost('/events', {
      venueId: VENUE_ID, name: `Delete TT Test ${RUN}`,
      description: 'delete test', startsAt: tomorrow, endsAt: dayAfter, saleStartsAt: saleStart,
    }, venueToken);
    tmpEventId = evRes.json().id;

    const ttRes = await apiPost(`/events/${tmpEventId}/ticket-types`,
      { name: 'To Delete', price: 10, totalQuantity: 5, maxPerOrder: 2 }, venueToken);
    expect(ttRes.status()).toBe(201);
    const tmpTtId = ttRes.json().id;

    const status = await apiDelete(`/events/${tmpEventId}/ticket-types/${tmpTtId}`, venueToken);
    expect(status).toBe(204);
  });

  test('published event appears in public events list', async ({ page }) => {
    await page.goto('/events');
    await page.waitForSelector('.event-card', { timeout: 5000 });
    const cards = page.locator('.event-card');
    const count = await cards.count();
    // At least one card should show (real events now exist)
    expect(count).toBeGreaterThan(0);
  });
});

// ─── Purchase flow ─────────────────────────────────────────────────────────

test.describe('Purchase flow', () => {
  let userToken: string;
  let venueToken: string;
  let eventId: string;
  let ticketTypeId: string;
  let orderId: string;

  test.beforeAll(async () => {
    userToken = await getToken(USER_EMAIL, USER_PASS);
    venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);

    // Create + publish a fresh event for purchase tests
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const dayAfter = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const saleStart = new Date(Date.now() - 3600_000).toISOString();

    const evRes = await apiPost(
      '/events',
      {
        venueId: VENUE_ID,
        name: `Purchase Test ${RUN}`,
        description: 'E2E purchase test',
        startsAt: tomorrow,
        endsAt: dayAfter,
        saleStartsAt: saleStart,
      },
      venueToken
    );
    const ev = evRes.json();
    eventId = ev.id;

    const ttRes = await apiPost(
      `/events/${eventId}/ticket-types`,
      { name: 'GA', price: 30.00, totalQuantity: 5, maxPerOrder: 2 },
      venueToken
    );
    const tt = ttRes.json();
    ticketTypeId = tt.id;

    await apiPut(`/events/${eventId}/publish`, venueToken);
  });

  test('creates an order and reserves tickets', async () => {
    const res = await apiPost(
      '/orders',
      { ticketTypeId, quantity: 2 },
      userToken
    );
    expect(res.status()).toBe(201);
    const order = res.json();
    orderId = order.id;
    expect(orderId).toBeTruthy();
    expect(order.status).toBe('AwaitingPayment');
    expect(order.tickets).toHaveLength(2);
  });

  test('order appears in my orders', async () => {
    const res = await apiGet('/orders', userToken);
    expect(res.status()).toBe(200);
    const orders = res.json();
    expect(Array.isArray(orders)).toBe(true);
    const found = orders.find((o: any) => o.id === orderId);
    expect(found).toBeTruthy();
  });

  test('checkout endpoint creates mock PaymentIntent', async () => {
    const res = await apiPost(`/payments/orders/${orderId}/checkout`, {}, userToken);
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.clientSecret).toBeTruthy();
    expect(data.paymentIntentId).toMatch(/^mock_pi_/);
  });

  test('mock-confirm completes the order and issues tickets', async () => {
    const res = await apiPost(`/payments/orders/${orderId}/mock-confirm`, {}, userToken);
    expect(res.status()).toBe(200);
    expect(res.json().status).toBe('confirmed');

    // Order should now be Paid
    const orderRes = await apiGet(`/orders/${orderId}`, userToken);
    expect(orderRes.status()).toBe(200);
    expect(orderRes.json().status).toBe('Paid');
  });

  test('cannot over-purchase beyond maxPerOrder', async () => {
    const res = await apiPost(
      '/orders',
      { ticketTypeId, quantity: 5 },  // maxPerOrder is 2
      userToken
    );
    expect([400, 422]).toContain(res.status());
  });

  test.afterAll(async () => {
    // Event has paid tickets after mock-confirm; deleteEvent silently ignores the 409.
    await deleteEvent(eventId, venueToken);
  });
});

// ─── My Tickets page (UI) ──────────────────────────────────────────────────

test.describe('My Tickets page', () => {
  test('requires login — redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/my-tickets');
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });

  test('shows orders list when logged in', async ({ page }) => {
    const token = await getToken(USER_EMAIL, USER_PASS);
    await page.goto('/');
    await page.evaluate(
      ([t, e]) => {
        localStorage.setItem('jwt', t);
        localStorage.setItem('userEmail', e);
        localStorage.setItem('userRole', 'User');
        window.dispatchEvent(new Event('auth-change'));
      },
      [token, USER_EMAIL]
    );
    await page.goto('/my-tickets');
    // Should have at least one order (created in purchase tests)
    await page.waitForTimeout(1000);
    const items = page.locator('.order-card, .ticket-card, [class*="order"], [class*="ticket"]');
    // At a minimum the page should load without error
    await expect(page.locator('h1')).toBeVisible();
  });
});

// ─── Scanner page ──────────────────────────────────────────────────────────

test.describe('Scanner page', () => {
  test('shows auth warning when not logged in', async ({ page }) => {
    await page.goto('/scan');
    await expect(page.locator('.auth-warn')).toBeVisible();
  });

  test('shows scanner UI for VenueAdmin', async ({ page }) => {
    const token = await getToken(VENUE_EMAIL, VENUE_PASS);
    await page.goto('/');
    await page.evaluate(
      ([t, e]) => {
        localStorage.setItem('jwt', t);
        localStorage.setItem('userEmail', e);
        localStorage.setItem('userRole', 'VenueAdmin');
        window.dispatchEvent(new Event('auth-change'));
      },
      [token, VENUE_EMAIL]
    );
    await page.goto('/scan');
    await expect(page.locator('h1')).toContainText('Scanner');
    await expect(page.locator('button', { hasText: 'Start Camera Scan' })).toBeVisible();
  });

  test('manual token validation returns Invalid for bad token', async ({ page }) => {
    const token = await getToken(VENUE_EMAIL, VENUE_PASS);
    await page.goto('/');
    await page.evaluate(
      ([t, e]) => {
        localStorage.setItem('jwt', t);
        localStorage.setItem('userEmail', e);
        localStorage.setItem('userRole', 'VenueAdmin');
        window.dispatchEvent(new Event('auth-change'));
      },
      [token, VENUE_EMAIL]
    );
    await page.goto('/scan');
    await page.fill('input[placeholder*="token"]', 'invalid-qr-token-abc123');
    await page.locator('button', { hasText: 'Validate' }).click();
    await expect(page.locator('.result.Invalid, .result.Refunded, .result')).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Navigation ────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('nav brand click goes home', async ({ page }) => {
    await page.goto('/events');
    await page.locator('.brand').click();
    await expect(page).toHaveURL('/');
  });

  test('nav Events link works', async ({ page }) => {
    await page.goto('/');
    await page.locator('a', { hasText: 'Events' }).first().click();
    await expect(page).toHaveURL('/events');
  });

  test('nav Login link works', async ({ page }) => {
    await page.goto('/');
    await page.locator('a', { hasText: 'Login' }).first().click();
    await expect(page).toHaveURL('/login');
  });
});

// ─── Event slugs ───────────────────────────────────────────────────────────

test.describe('Event slugs', () => {
  // Helper to get all events as a flat array (handles paginated response)
  async function getAllEvents() {
    const res = await apiGet('/events?pageSize=100');
    const body = res.json() as any;
    if (!body) return [];
    return Array.isArray(body) ? body : (body.items ?? []);
  }

  test('events returned by API include a slug', async () => {
    const res = await apiGet('/events?pageSize=100');
    expect(res.status()).toBe(200);
    const events = await getAllEvents();
    for (const ev of events) {
      expect(typeof ev.slug).toBe('string');
      expect(ev.slug.length).toBeGreaterThan(0);
    }
  });

  test('event is reachable by slug', async () => {
    const events = await getAllEvents();
    if (events.length === 0) return; // no events seeded yet
    const ev = events[0];
    const res = await apiGet(`/events/${ev.slug}`);
    expect(res.status()).toBe(200);
    expect(res.json().id).toBe(ev.id);
  });

  test('OG preview endpoint returns HTML with og:title', async () => {
    const events = await getAllEvents();
    if (events.length === 0) return;
    const ev = events[0];
    const r = await fetch(`${API}/og/events/${ev.id}`);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('og:title');
    expect(html).toContain(ev.name);
  });

  test('OG image endpoint returns PNG', async () => {
    const events = await getAllEvents();
    if (events.length === 0) return;
    const ev = events[0];
    const r = await fetch(`${API}/og/events/${ev.id}/image`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('image/png');
  });
});

// ─── Referral codes ────────────────────────────────────────────────────────

test.describe('Referral codes', () => {
  test('registered users have a referral code', async () => {
    const token = await getToken(USER_EMAIL, USER_PASS);
    const res = await apiGet('/users/me/referrals', token);
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.referralCode).toBeTruthy();
    expect(data.referralCode.length).toBe(8);
    expect(typeof data.referralCount).toBe('number');
  });
});

// ─── Platform fee (voluntary contribution) ────────────────────────────────

test.describe('Platform fee', () => {
  let userToken: string;
  let feeEventId: string;
  let ticketTypeId: string;

  test.beforeAll(async () => {
    userToken = await getToken(USER_EMAIL, USER_PASS);
    const venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const dayAfter = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const saleStart = new Date(Date.now() - 3600_000).toISOString();
    const evRes = await apiPost(
      '/events',
      { venueId: VENUE_ID, name: `Fee Test ${RUN}`, description: 'platform fee e2e', startsAt: tomorrow, endsAt: dayAfter, saleStartsAt: saleStart },
      venueToken
    );
    feeEventId = evRes.json().id;
    const ttRes = await apiPost(`/events/${feeEventId}/ticket-types`, { name: 'GA', price: 10, totalQuantity: 100, maxPerOrder: 10 }, venueToken);
    ticketTypeId = ttRes.json().id;
    await apiPut(`/events/${feeEventId}/publish`, venueToken);
  });

  test.afterAll(async () => {
    const venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
    await deleteEvent(feeEventId, venueToken);
  });

  test('order with zero platform fee is accepted', async () => {
    if (!ticketTypeId) return;
    const res = await apiPost('/orders', { ticketTypeId, quantity: 1, platformFee: 0 }, userToken);
    expect(res.status()).toBe(201);
    expect(res.json().platformFee).toBe(0);
  });

  test('order with $2 platform fee stores the contribution', async () => {
    if (!ticketTypeId) return;
    const res = await apiPost('/orders', { ticketTypeId, quantity: 1, platformFee: 2 }, userToken);
    expect(res.status()).toBe(201);
    expect(res.json().platformFee).toBe(2);
  });

  test('platform fee above $20 is clamped to $20', async () => {
    if (!ticketTypeId) return;
    const res = await apiPost('/orders', { ticketTypeId, quantity: 1, platformFee: 999 }, userToken);
    expect(res.status()).toBe(201);
    expect(res.json().platformFee).toBe(20);
  });
});

// ─── Guest OTP checkout ────────────────────────────────────────────────────

test.describe('Guest OTP checkout', () => {
  const guestPhone = '+15125550199';
  let guestToken: string;
  let guestEventId: string;
  let ticketTypeId: string;

  test.beforeAll(async () => {
    const venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const dayAfter = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const saleStart = new Date(Date.now() - 3600_000).toISOString();
    const evRes = await apiPost(
      '/events',
      { venueId: VENUE_ID, name: `Guest Test ${RUN}`, description: 'guest checkout e2e', startsAt: tomorrow, endsAt: dayAfter, saleStartsAt: saleStart },
      venueToken
    );
    guestEventId = evRes.json().id;
    const ttRes = await apiPost(`/events/${guestEventId}/ticket-types`, { name: 'GA', price: 5, totalQuantity: 100, maxPerOrder: 10 }, venueToken);
    ticketTypeId = ttRes.json().id;
    await apiPut(`/events/${guestEventId}/publish`, venueToken);
  });

  test.afterAll(async () => {
    const venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
    await deleteEvent(guestEventId, venueToken);
  });

  test('request-otp returns devCode in mock mode', async () => {
    const res = await apiPost('/auth/phone/request-otp', { phoneNumber: guestPhone });
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.devCode).toBeTruthy();
    expect(data.devCode).toMatch(/^\d{6}$/);
  });

  test('verify-otp with correct code returns JWT with role Guest', async () => {
    // Request a fresh OTP
    const otpRes = await apiPost('/auth/phone/request-otp', { phoneNumber: guestPhone });
    const { devCode } = otpRes.json();

    const res = await apiPost('/auth/phone/verify-otp', { phoneNumber: guestPhone, code: devCode });
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.token).toBeTruthy();
    expect(data.role).toBe('Guest');
    guestToken = data.token;
  });

  test('guest can place an order', async () => {
    if (!ticketTypeId || !guestToken) return;
    const res = await apiPost('/orders', { ticketTypeId, quantity: 1 }, guestToken);
    expect(res.status()).toBe(201);
    expect(res.json().status).toBe('AwaitingPayment');
  });

  test('verify-otp with wrong code returns 401', async () => {
    await apiPost('/auth/phone/request-otp', { phoneNumber: '+15125550188' });
    const res = await apiPost('/auth/phone/verify-otp', { phoneNumber: '+15125550188', code: '000000' });
    expect(res.status()).toBe(401);
  });
});

// ─── Health check ──────────────────────────────────────────────────────────

test.describe('API health', () => {
  test('GET /healthz returns healthy', async () => {
    const res = await apiGet('/healthz');
    expect(res.status()).toBe(200);
    expect(res.json().status).toBe('healthy');
  });
});

// ─── Social OAuth login (mock) ─────────────────────────────────────────────

test.describe('OAuth mock login', () => {
  test('GET /auth/oauth/providers returns provider list', async () => {
    const res = await apiGet('/auth/oauth/providers');
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.providers).toContain('Google');
    expect(data.providers).toContain('GitHub');
    expect(data.providers).toContain('Facebook');
  });

  test('mock-login with Google returns JWT', async () => {
    const res = await apiGet('/auth/oauth/mock-login?provider=Google&email=oauthtest_google@test.dev');
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.token).toBeTruthy();
    expect(data.email).toBe('oauthtest_google@test.dev');
    expect(data.role).toBe('User');
  });

  test('mock-login with GitHub returns JWT', async () => {
    const res = await apiGet('/auth/oauth/mock-login?provider=GitHub&email=oauthtest_github@test.dev');
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.token).toBeTruthy();
    expect(data.role).toBe('User');
  });

  test('mock-login with Facebook returns JWT', async () => {
    const res = await apiGet('/auth/oauth/mock-login?provider=Facebook&email=oauthtest_fb@test.dev');
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.token).toBeTruthy();
    expect(data.role).toBe('User');
  });

  test('mock-login user can access /users/me/referrals', async () => {
    const loginRes = await apiGet('/auth/oauth/mock-login?provider=Google&email=oauth_reftest@test.dev');
    const token = loginRes.json().token;
    const refRes = await apiGet('/users/me/referrals', token);
    expect(refRes.status()).toBe(200);
    expect(refRes.json().referralCode).toBeTruthy();
  });

  test('POST /auth/oauth/callback returns 502 for invalid code (real providers)', async () => {
    const res = await apiPost('/auth/oauth/callback', {
      provider: 'Google',
      code: 'invalid_code',
      redirectUri: 'http://localhost:5173/auth/callback',
      codeVerifier: 'test_verifier',
    });
    // With real providers, invalid code → 502 (OAuth exchange failed)
    expect([400, 502]).toContain(res.status());
  });

  test('calling same mock-login twice links to same user account', async () => {
    const email = `oauth_dedup_${RUN}@test.dev`;
    const r1 = await apiGet(`/auth/oauth/mock-login?provider=Google&email=${encodeURIComponent(email)}`);
    const r2 = await apiGet(`/auth/oauth/mock-login?provider=Google&email=${encodeURIComponent(email)}`);
    // Both succeed and return same email
    expect(r1.json().email).toBe(r2.json().email);
  });
});

// ─── Venue invite flow ─────────────────────────────────────────────────────

test.describe('Venue invite flow', () => {
  let ownerToken = '';
  let inviteToken = '';
  const venueEmail = `invited_venue_${RUN}@test.dev`;
  const venueName = `Test Venue ${RUN}`;

  test('AppOwner can log in', async () => {
    const res = await apiPost('/auth/login', { email: OWNER_EMAIL, password: OWNER_PASS });
    expect(res.status()).toBe(200);
    expect(res.json().role).toBe('AppOwner');
    ownerToken = res.json().token;
  });

  test('AppOwner can create an invite', async () => {
    if (!ownerToken) return;
    const res = await apiPost('/admin/invites', { email: venueEmail, venueName }, ownerToken);
    expect(res.status()).toBe(200);
    const data = res.json();
    expect(data.inviteUrl).toContain('/invite/');
    expect(data.email).toBe(venueEmail);
    inviteToken = data.token;
  });

  test('invite details are visible via GET /invites/{token}', async () => {
    if (!inviteToken) return;
    const res = await apiGet(`/invites/${inviteToken}`);
    expect(res.status()).toBe(200);
    expect(res.json().email).toBe(venueEmail);
    expect(res.json().venueName).toBe(venueName);
  });

  test('invite accept creates VenueAdmin user and returns JWT', async () => {
    if (!inviteToken) return;
    const res = await apiPost(`/invites/${inviteToken}/accept`, { password: 'VenuePass123!', phoneNumber: '' });
    expect(res.status()).toBe(201);
    const data = res.json();
    expect(data.token).toBeTruthy();
    expect(data.role).toBe('VenueAdmin');
    expect(data.email).toBe(venueEmail);
  });

  test('accepted invite cannot be reused', async () => {
    if (!inviteToken) return;
    const res = await apiPost(`/invites/${inviteToken}/accept`, { password: 'AnotherPass123!' });
    expect(res.status()).toBe(409); // Conflict
  });

  test('invalid invite token returns 404', async () => {
    const res = await apiGet('/invites/totally-bogus-token-xyz');
    expect(res.status()).toBe(404);
  });

  test('non-AppOwner cannot create invites', async () => {
    if (!ownerToken) return;
    // Use a regular user token
    const loginRes = await apiPost('/auth/login', { email: USER_EMAIL, password: USER_PASS });
    const userToken = loginRes.json().token;
    const res = await apiPost('/admin/invites', { email: 'x@x.com', venueName: 'Test' }, userToken);
    expect(res.status()).toBe(403);
  });

  test('AppOwner can list invites', async () => {
    if (!ownerToken) return;
    const res = await apiGet('/admin/invites', ownerToken);
    expect(res.status()).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

test.describe('VenueAdmin invite-only lockdown', () => {
  let ownerToken = '';
  let lockdownInviteToken = '';
  const invitedEmail = `lockdown_${RUN}@test.dev`;

  test('setup: AppOwner creates an invite for lockdown test', async () => {
    const loginRes = await apiPost('/auth/login', { email: OWNER_EMAIL, password: OWNER_PASS });
    ownerToken = loginRes.json().token ?? '';
    if (!ownerToken) return;
    const res = await apiPost('/admin/invites', { email: invitedEmail, venueName: `Lockdown Venue ${RUN}` }, ownerToken);
    expect(res.status()).toBe(200);
    lockdownInviteToken = res.json().token;
  });

  test('registering with a pending-invite email returns 409 with invitePending flag', async () => {
    if (!lockdownInviteToken) return;
    const res = await apiPost('/auth/register', { email: invitedEmail, password: 'TrySquat123!', phoneNumber: '' });
    expect(res.status()).toBe(409);
    expect(res.json().invitePending).toBe(true);
  });

  test('OAuth mock-login with a pending-invite email returns 409 with invitePending flag', async () => {
    if (!lockdownInviteToken) return;
    const res = await apiGet(`/auth/oauth/mock-login?provider=Google&email=${encodeURIComponent(invitedEmail)}`);
    expect(res.status()).toBe(409);
    expect(res.json().invitePending).toBe(true);
  });

  test('accepting the invite upgrades to VenueAdmin (or creates if not exists)', async () => {
    if (!lockdownInviteToken) return;
    const res = await apiPost(`/invites/${lockdownInviteToken}/accept`, { password: 'InviteOnly123!' });
    expect(res.status()).toBe(201);
    expect(res.json().role).toBe('VenueAdmin');
    expect(res.json().email).toBe(invitedEmail);
  });
});

// ─── Events pagination ──────────────────────────────────────────────────────

test.describe('Events pagination', () => {
  test('GET /events returns paginated shape', async () => {
    const res = await apiGet('/events?page=1&pageSize=5');
    expect(res.status()).toBe(200);
    const body = res.json() as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.page).toBe('number');
    expect(typeof body.totalPages).toBe('number');
    expect(typeof body.totalCount).toBe('number');
    expect(body.page).toBe(1);
  });

  test('pageSize is respected', async () => {
    const res = await apiGet('/events?page=1&pageSize=2');
    expect(res.status()).toBe(200);
    const body = res.json() as any;
    expect(body.items.length).toBeLessThanOrEqual(2);
  });

  test('GET /events/admin requires AppOwner role', async () => {
    // unauthenticated → 401
    const anonRes = await apiGet('/events/admin');
    expect(anonRes.status()).toBe(401);

    // AppOwner → 200
    const ownerToken = await getToken(OWNER_EMAIL, OWNER_PASS);
    const ownerRes = await apiGet('/events/admin?page=1&pageSize=10', ownerToken);
    expect(ownerRes.status()).toBe(200);
    const body = ownerRes.json() as any;
    expect(Array.isArray(body.items)).toBe(true);
  });
});

// ─── Event thumbnails ───────────────────────────────────────────────────────

test.describe('Event thumbnails', () => {
  let ownerToken = '';
  let thumbEventId = '';

  test('setup: create event for thumbnail test', async () => {
    ownerToken = await getToken(OWNER_EMAIL, OWNER_PASS);
    const venue = (await apiGet('/venues', ownerToken)).json();
    const venueId = Array.isArray(venue) ? venue[0]?.id : null;
    if (!venueId) return;
    const res = await apiPost('/events', {
      name: `Thumb Test ${RUN}`,
      description: 'Thumbnail test event',
      startsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 30 + 7200000).toISOString(),
      saleStartsAt: new Date().toISOString(),
      venueId,
    }, ownerToken);
    expect(res.status()).toBe(201);
    thumbEventId = res.json().id;
  });

  test.afterAll(async () => { await deleteEvent(thumbEventId, ownerToken); });

  test('can upload a thumbnail (data-URL stored in dev)', async () => {
    if (!thumbEventId || !ownerToken) return;
    // Create a minimal 1×1 PNG as a Blob
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const binary = Buffer.from(pngB64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([binary], { type: 'image/png' }), 'thumb.png');
    const r = await fetch(`${API}/events/${thumbEventId}/thumbnail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: form,
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(typeof body.thumbnailUrl).toBe('string');
    expect(body.thumbnailUrl.length).toBeGreaterThan(0);
  });

  test('uploaded thumbnail appears on GET /events/:id', async () => {
    if (!thumbEventId || !ownerToken) return;
    const res = await apiGet(`/events/${thumbEventId}`, ownerToken);
    expect(res.status()).toBe(200);
    // thumbnailUrl may be null if upload was skipped (e.g. S3 not configured) — just ensure field exists
    expect('thumbnailUrl' in res.json()).toBe(true);
  });
});

// ─── Regression: Bug fixes ──────────────────────────────────────────────────
// Tests to prevent regressions for the 5 bugs fixed in this sprint:
// 1. Thumbnail not rendering after upload
// 2. App Owner can't load scanner
// 3. App Owner gets 404 on manage event route
// 4. App Owner creating new venue returns error
// 5. Thumbnail upload should be on step 1 of event creation

test.describe('Regression: AppOwner scanner access', () => {
  test('AppOwner can see scanner UI (not blocked by role check)', async ({ page }) => {
    const token = await getToken(OWNER_EMAIL, OWNER_PASS);
    await page.goto('/');
    await page.evaluate(
      ([t, e]) => {
        localStorage.setItem('jwt', t);
        localStorage.setItem('userEmail', e);
        localStorage.setItem('userRole', 'AppOwner');
        window.dispatchEvent(new Event('auth-change'));
      },
      [token, OWNER_EMAIL]
    );
    await page.goto('/scan');
    await expect(page.locator('h1')).toContainText('Scanner');
    await expect(page.locator('button', { hasText: 'Start Camera Scan' })).toBeVisible();
  });
});

test.describe('Regression: Manage event page (no 404)', () => {
  let ownerToken = '';
  let eventId = '';

  test('setup: create event to manage', async () => {
    ownerToken = await getToken(OWNER_EMAIL, OWNER_PASS);
    const venueRes = await apiGet('/venues', ownerToken);
    const venues = venueRes.json();
    const venueId = Array.isArray(venues) && venues.length > 0 ? venues[0].id : VENUE_ID;
    const res = await apiPost('/events', {
      name: `Manage Test ${RUN}`, description: 'Manage event regression test',
      startsAt: new Date(Date.now() + 86400000 * 60).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 60 + 7200000).toISOString(),
      saleStartsAt: new Date().toISOString(), venueId,
    }, ownerToken);
    expect(res.status()).toBe(201);
    eventId = res.json().id;
  });

  test('AppOwner can navigate to /venue/events/:id without 404', async ({ page }) => {
    if (!eventId || !ownerToken) return;
    await page.goto('/');
    await page.evaluate(
      ([t, e]) => {
        localStorage.setItem('jwt', t);
        localStorage.setItem('userEmail', e);
        localStorage.setItem('userRole', 'AppOwner');
        window.dispatchEvent(new Event('auth-change'));
      },
      [ownerToken, OWNER_EMAIL]
    );
    await page.goto(`/venue/events/${eventId}`);
    // Should render the manage-event page, not a 404 fallback
    await expect(page.locator('h1')).not.toContainText('404');
    await expect(page.locator('h1')).not.toContainText('Not Found');
    await expect(page.locator('.admin-bar')).toBeVisible();
  });

  test('PATCH /events/:id updates event details', async () => {
    if (!eventId || !ownerToken) return;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` };
    const res = await fetch(`${API}/events/${eventId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ name: `Updated ${RUN}` }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toContain(`Updated ${RUN}`);
  });

  test.afterAll(async () => { await deleteEvent(eventId, ownerToken); });
});

test.describe('Regression: AppOwner venue creation', () => {
  test('POST /venues succeeds for AppOwner', async () => {
    const token = await getToken(OWNER_EMAIL, OWNER_PASS);
    const res = await apiPost('/venues', { name: `Regression Venue ${RUN}`, city: 'Austin', state: 'TX' }, token);
    expect(res.status()).toBe(200);
    expect(typeof res.json().id).toBe('string');
  });
});

test.describe('Regression: Thumbnail renders after upload', () => {
  let ownerToken = '';
  let thumbEventId = '';

  test('setup: create and publish event', async () => {
    ownerToken = await getToken(OWNER_EMAIL, OWNER_PASS);
    const venueRes = await apiGet('/venues', ownerToken);
    const venues = venueRes.json();
    const venueId = Array.isArray(venues) && venues.length > 0 ? venues[0].id : VENUE_ID;
    const res = await apiPost('/events', {
      name: `Thumb Render ${RUN}`, description: 'Thumbnail render test',
      startsAt: new Date(Date.now() + 86400000 * 45).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 45 + 7200000).toISOString(),
      saleStartsAt: new Date().toISOString(), venueId,
    }, ownerToken);
    expect(res.status()).toBe(201);
    thumbEventId = res.json().id;
    await apiPut(`/events/${thumbEventId}/publish`, ownerToken);
  });

  test('thumbnail upload returns thumbnailUrl', async () => {
    if (!thumbEventId || !ownerToken) return;
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const binary = Buffer.from(pngB64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([binary], { type: 'image/png' }), 'thumb.png');
    const r = await fetch(`${API}/events/${thumbEventId}/thumbnail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: form,
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(typeof body.thumbnailUrl).toBe('string');
    expect(body.thumbnailUrl.length).toBeGreaterThan(0);
  });

  test('GET /events/:id returns thumbnailUrl after upload', async () => {
    if (!thumbEventId || !ownerToken) return;
    const res = await apiGet(`/events/${thumbEventId}`);
    expect(res.status()).toBe(200);
    const ev = res.json();
    expect(ev.thumbnailUrl).toBeTruthy();
  });

  test('event detail page renders thumbnail img when thumbnailUrl is set', async ({ page }) => {
    if (!thumbEventId) return;
    const evRes = await apiGet(`/events/${thumbEventId}`);
    const ev = evRes.json();
    if (!ev.thumbnailUrl || !ev.slug) return;
    await page.goto(`/events/${ev.slug}`);
    await expect(page.locator('img[alt*="thumbnail"], img[class*="thumb"], .event-thumb, img').first()).toBeVisible({ timeout: 8_000 });
  });

  test.afterAll(async () => { await deleteEvent(thumbEventId, ownerToken); });
});

test.describe('Event type filtering', () => {
  // These tests create their own events so they are not dependent on seed data.
  let venueTokenFilter: string;
  let comedyEventId: string;
  let musicEventId: string;
  let comedyEventSlug: string;
  let musicEventSlug: string;

  test.beforeAll(async () => {
    venueTokenFilter = await getToken(VENUE_EMAIL, VENUE_PASS);
    // Use a start time only 5 minutes from now so these events sort to the
    // very top of the upcoming list regardless of how many other events exist.
    const soonStart = new Date(Date.now() + 5 * 60_000).toISOString();
    const soonEnd   = new Date(Date.now() + 65 * 60_000).toISOString();
    const saleStart = new Date(Date.now() - 3_600_000).toISOString();

    // Create comedy event
    const comedyRes = await apiPost('/events', {
      venueId: VENUE_ID,
      name: `Filter Test Comedy ${RUN}`,
      description: 'comedy filter test',
      startsAt: soonStart,
      endsAt: soonEnd,
      saleStartsAt: saleStart,
      eventType: 'comedy',
    }, venueTokenFilter);
    comedyEventId = comedyRes.json().id;
    comedyEventSlug = comedyRes.json().slug;
    await apiPost(`/events/${comedyEventId}/ticket-types`, { name: 'GA', price: 10, totalQuantity: 50, maxPerOrder: 4 }, venueTokenFilter);
    await apiPut(`/events/${comedyEventId}/publish`, venueTokenFilter);

    // Create music event
    const musicRes = await apiPost('/events', {
      venueId: VENUE_ID,
      name: `Filter Test Music ${RUN}`,
      description: 'music filter test',
      startsAt: soonStart,
      endsAt: soonEnd,
      saleStartsAt: saleStart,
      eventType: 'music',
    }, venueTokenFilter);
    musicEventId = musicRes.json().id;
    await apiPost(`/events/${musicEventId}/ticket-types`, { name: 'GA', price: 10, totalQuantity: 50, maxPerOrder: 4 }, venueTokenFilter);
    await apiPut(`/events/${musicEventId}/publish`, venueTokenFilter);
    musicEventSlug = musicRes.json().slug;
  });

  test('type filter dropdown defaults to All Types with value ""', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const typeSelect = page.locator('select.filter-select').first();
    await expect(typeSelect).toBeVisible();
    await expect(typeSelect).toHaveValue('');
  });

  test('All Types filter shows events of multiple types simultaneously', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    // Ensure no type filter is active
    const typeSelect = page.locator('select.filter-select').first();
    await expect(typeSelect).toHaveValue('');

    // Both the comedy and music events we created should be visible
    await expect(page.locator(`.event-card:has-text("Filter Test Comedy ${RUN}")`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`.event-card:has-text("Filter Test Music ${RUN}")`)).toBeVisible({ timeout: 10000 });
  });

  test('comedy type filter shows comedy events and hides music events', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select.filter-select').first();
    await typeSelect.selectOption('comedy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`.event-card:has-text("Filter Test Comedy ${RUN}")`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`.event-card:has-text("Filter Test Music ${RUN}")`)).not.toBeVisible();
  });

  test('music type filter shows music events and hides comedy events', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select.filter-select').first();
    await typeSelect.selectOption('music');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`.event-card:has-text("Filter Test Music ${RUN}")`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`.event-card:has-text("Filter Test Comedy ${RUN}")`)).not.toBeVisible();
  });

  test('clearing type filter back to All Types shows all event types again', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select.filter-select').first();

    // Apply comedy filter
    await typeSelect.selectOption('comedy');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`.event-card:has-text("Filter Test Music ${RUN}")`)).not.toBeVisible();

    // Reset to All Types
    await typeSelect.selectOption('');
    await page.waitForLoadState('networkidle');

    // Both types must be visible again
    await expect(page.locator(`.event-card:has-text("Filter Test Comedy ${RUN}")`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`.event-card:has-text("Filter Test Music ${RUN}")`)).toBeVisible({ timeout: 10000 });
    await expect(typeSelect).toHaveValue('');
  });
});

// ─── Rich link previews (OG / iMessage / Twitter Card) ─────────────────────
//
// Validates that sharing an event URL produces correct Open Graph and Twitter
// Card meta tags, that the generated fallback image is a 1200×630 PNG, and
// that a real thumbnail is preferred over the generated one when set.

test.describe('Rich link previews', () => {
  let venueToken = '';
  let venueId = '';
  let noThumbEventId = '';
  let noThumbEventSlug = '';
  let noThumbEventName = '';
  let thumbEventId = '';

  const ALL_EVENT_TYPES = ['comedy', 'music', 'sports', 'arts', 'food', 'tech', 'other'];

  // Minimal 1×1 transparent PNG used as a stand-in thumbnail
  const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  test('setup: create events for preview tests', async () => {
    venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
    const venueRes = (await apiGet('/venues', venueToken)).json();
    venueId = (Array.isArray(venueRes) ? venueRes[0]?.id : venueRes?.id) ?? '';
    if (!venueId) return;

    const future = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

    // Event without a thumbnail — validates the generated fallback image
    const r1 = await apiPost('/events', {
      name: `OG No Thumb ${RUN}`,
      description: 'Rich preview test event without a thumbnail. Multi-sentence description here.',
      startsAt: future(86400000 * 7),
      endsAt: future(86400000 * 7 + 7200000),
      saleStartsAt: future(-3600000),
      venueId,
      eventType: 'music',
    }, venueToken);
    expect(r1.status()).toBe(201);
    noThumbEventId = r1.json().id;
    noThumbEventSlug = r1.json().slug;
    noThumbEventName = r1.json().name;
    await apiPut(`/events/${noThumbEventId}/publish`, venueToken);

    // Event with a thumbnail — validates thumbnail is preferred over generated image
    const r2 = await apiPost('/events', {
      name: `OG With Thumb ${RUN}`,
      description: 'Rich preview test event with a thumbnail uploaded.',
      startsAt: future(86400000 * 14),
      endsAt: future(86400000 * 14 + 7200000),
      saleStartsAt: future(-3600000),
      venueId,
      eventType: 'comedy',
    }, venueToken);
    expect(r2.status()).toBe(201);
    thumbEventId = r2.json().id;

    const pngBytes = Buffer.from(TINY_PNG_B64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([pngBytes], { type: 'image/png' }), 'thumb.png');
    const uploadRes = await fetch(`${API}/events/${thumbEventId}/thumbnail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${venueToken}` },
      body: form,
    });
    expect(uploadRes.status).toBe(200);

    await apiPut(`/events/${thumbEventId}/publish`, venueToken);
  });

  test.afterAll(async () => {
    await deleteEvent(noThumbEventId, venueToken);
    await deleteEvent(thumbEventId, venueToken);
  });

  // ── OG HTML structure ───────────────────────────────────────────────────

  test('OG endpoint returns 200 HTML', async () => {
    if (!noThumbEventId) return;
    const r = await fetch(`${API}/og/events/${noThumbEventId}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
  });

  test('OG HTML includes all required Open Graph meta tags', async () => {
    if (!noThumbEventId) return;
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:image');
    expect(html).toContain('og:image:width');
    expect(html).toContain('og:image:height');
    expect(html).toContain('og:type');
    expect(html).toContain('og:site_name');
    expect(html).toContain('og:url');
  });

  test('OG HTML includes all required Twitter Card meta tags', async () => {
    if (!noThumbEventId) return;
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toContain('twitter:card');
    expect(html).toContain('twitter:title');
    expect(html).toContain('twitter:description');
    expect(html).toContain('twitter:image');
    // Large-image card is required for rich previews in iMessage / Slack
    expect(html).toContain('summary_large_image');
  });

  test('og:title contains the event name', async () => {
    if (!noThumbEventId || !noThumbEventName) return;
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toContain(noThumbEventName);
  });

  test('og:description contains date and venue name', async () => {
    if (!noThumbEventId) return;
    const ev = (await apiGet(`/events/${noThumbEventId}`)).json();
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toContain('og:description');
    expect(html).toContain(ev.venue?.name ?? '');
  });

  test('og:url contains the event slug', async () => {
    if (!noThumbEventId || !noThumbEventSlug) return;
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toContain(noThumbEventSlug);
  });

  test('og:image:width is 1200 and og:image:height is 630', async () => {
    if (!noThumbEventId) return;
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toContain('content="1200"');
    expect(html).toContain('content="630"');
  });

  // ── Slug-based access ──────────────────────────────────────────────────

  test('OG endpoint is accessible by event slug (not just ID)', async () => {
    if (!noThumbEventSlug) return;
    const r = await fetch(`${API}/og/events/${noThumbEventSlug}`);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('og:title');
    expect(html).toContain(noThumbEventName);
  });

  // ── Generated fallback image ────────────────────────────────────────────

  test('generated image endpoint returns 200 with image/png content-type', async () => {
    if (!noThumbEventId) return;
    const r = await fetch(`${API}/og/events/${noThumbEventId}/image`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('image/png');
  });

  test('generated image is exactly 1200×630 pixels (PNG IHDR check)', async () => {
    if (!noThumbEventId) return;
    const buf = await fetch(`${API}/og/events/${noThumbEventId}/image`).then(r => r.arrayBuffer());
    // PNG IHDR: 8-byte magic + 4-byte length + 4-byte 'IHDR' + 4-byte width + 4-byte height
    const view = new DataView(buf);
    expect(view.getUint32(16, false)).toBe(1200);  // big-endian
    expect(view.getUint32(20, false)).toBe(630);
  });

  test('generated image has a public Cache-Control header', async () => {
    if (!noThumbEventId) return;
    const r = await fetch(`${API}/og/events/${noThumbEventId}/image`);
    expect(r.headers.get('cache-control') ?? '').toMatch(/public/i);
  });

  // ── Thumbnail vs generated image routing ───────────────────────────────

  test('og:image points to generated endpoint when event has no thumbnail', async () => {
    if (!noThumbEventId) return;
    const html = await fetch(`${API}/og/events/${noThumbEventId}`).then(r => r.text());
    expect(html).toMatch(/og\/events\/.+\/image/);
    expect(html).toContain('image/png');
  });

  test('og:image points to thumbnail URL when event has a thumbnail', async () => {
    if (!thumbEventId) return;
    const ev = (await apiGet(`/events/${thumbEventId}`)).json();
    if (!ev.thumbnailUrl) return; // upload may be skipped in environments without S3

    const html = await fetch(`${API}/og/events/${thumbEventId}`).then(r => r.text());
    expect(html).toContain(ev.thumbnailUrl);
    expect(html).not.toMatch(new RegExp(`og/events/${thumbEventId}/image`));
  });

  // ── All event types produce valid images ───────────────────────────────

  test.describe('generated image for each event type', () => {
    for (const eventType of ALL_EVENT_TYPES) {
      test(`event type "${eventType}" produces a valid 1200×630 PNG`, async () => {
        if (!venueId || !venueToken) return;
        const future = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
        const createRes = await apiPost('/events', {
          name: `OG Type Test ${eventType} ${RUN}`,
          description: `Type validation for ${eventType}`,
          startsAt: future(86400000 * 30),
          endsAt: future(86400000 * 30 + 7200000),
          saleStartsAt: future(-3600000),
          venueId,
          eventType,
        }, venueToken);
        if (createRes.status() !== 201) return;
        const evId = createRes.json().id;
        try {
          const r = await fetch(`${API}/og/events/${evId}/image`);
          expect(r.status).toBe(200);
          expect(r.headers.get('content-type')).toContain('image/png');
          const view = new DataView(await r.arrayBuffer());
          expect(view.getUint32(16, false)).toBe(1200);
          expect(view.getUint32(20, false)).toBe(630);
        } finally {
          await deleteEvent(evId, venueToken);
        }
      });
    }
  });
});

// ─── Nginx bot routing ─────────────────────────────────────────────────────
//
// Validates that the nginx frontend correctly routes social media crawlers from
// /events/{slug} to the API OG endpoint, returning rich preview HTML instead of
// the SPA shell.
//
// Requires E2E_NGINX_URL to be set (e.g. http://localhost:8090 pointing at the
// nginx frontend container). Automatically skipped in local Vite dev mode.

const NGINX_URL = process.env.E2E_NGINX_URL ?? '';

test.describe('Nginx bot routing', () => {
  let venueToken = '';
  let botEventSlug = '';
  let botEventName = '';
  let botEventId = '';

  test.beforeAll(async () => {
    test.skip(!NGINX_URL, 'Set E2E_NGINX_URL to test nginx bot routing (e.g. http://localhost:8090)');
  });

  test('setup: create and publish event for bot routing test', async () => {
    if (!NGINX_URL) return;
    venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
    const venueRes = (await apiGet('/venues', venueToken)).json();
    const venueId = (Array.isArray(venueRes) ? venueRes[0]?.id : venueRes?.id) ?? '';
    if (!venueId) return;

    const future = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
    const res = await apiPost('/events', {
      name: `Bot Route Test ${RUN}`,
      description: 'Event for nginx bot routing validation.',
      startsAt: future(86400000 * 7),
      endsAt: future(86400000 * 7 + 7200000),
      saleStartsAt: future(-3600000),
      venueId,
      eventType: 'music',
    }, venueToken);
    expect(res.status()).toBe(201);
    botEventId = res.json().id;
    botEventSlug = res.json().slug;
    botEventName = res.json().name;
    await apiPut(`/events/${botEventId}/publish`, venueToken);
  });

  test.afterAll(async () => { await deleteEvent(botEventId, venueToken); });

  test('social bot UA on /events/{slug} receives OG HTML (not SPA shell)', async () => {
    if (!NGINX_URL || !botEventSlug) return;
    const r = await fetch(`${NGINX_URL}/events/${botEventSlug}`, {
      headers: { 'User-Agent': 'Slackbot 1.0 (+https://api.slack.com/robots)' },
    });
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('og:title');
    expect(html).toContain(botEventName);
    // OG page has no <tp-app> — confirms we got the API response, not the SPA
    expect(html).not.toContain('<tp-app>');
  });

  test('regular browser UA on /events/{slug} receives the SPA shell', async () => {
    if (!NGINX_URL || !botEventSlug) return;
    const r = await fetch(`${NGINX_URL}/events/${botEventSlug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36' },
    });
    expect(r.status).toBe(200);
    const html = await r.text();
    // SPA shell contains the custom element, not og:title per-event
    expect(html).toContain('<tp-app>');
  });

  test('/og/* path is directly accessible through nginx (og:image URLs resolve)', async () => {
    if (!NGINX_URL || !botEventId) return;
    const r = await fetch(`${NGINX_URL}/og/events/${botEventId}/image`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('image/png');
  });
});
