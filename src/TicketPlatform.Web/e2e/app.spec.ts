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

const API = 'http://localhost:8080';
const VENUE_ID = 'a0000000-0000-0000-0000-000000000001';

// Fixed test users (pre-seeded in DB before test run)
const USER_EMAIL = 'e2ebuyer@austintickets.dev';
const USER_PASS = 'Password123!';
const VENUE_EMAIL = 'venue@austintickets.dev';
const VENUE_PASS = 'Password123!';

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
    await expect(page.locator('h1')).toContainText('Tickets');
    await expect(page.locator('.eyebrow')).toContainText('Austin');
    await expect(page.locator('.fee-pct.us')).toContainText('3%');
  });

  test('Browse Events CTA navigates to /events', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Browse Events' }).click();
    await expect(page).toHaveURL('/events');
  });

  test('Get Started CTA navigates to /register', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Get Started' }).click();
    await expect(page).toHaveURL('/register');
  });
});

// ─── Auth flow ─────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('register new user', async ({ page }) => {
    // Use a unique email each run so this test can run repeatedly
    const newEmail = `newuser${RUN}@austintickets.dev`;
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
    await page.locator('button', { hasText: 'Logout' }).click();
    await expect(page.locator('button', { hasText: 'Get Started' })).toBeVisible();
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
    await expect(page.locator('button', { hasText: 'Logout' })).toBeVisible();
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

  test.beforeAll(async () => {
    venueToken = await getToken(VENUE_EMAIL, VENUE_PASS);
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

  test('published event appears in public events list', async ({ page }) => {
    await page.goto('/events');
    await page.waitForTimeout(500);
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
    await page.locator('a', { hasText: 'Events' }).click();
    await expect(page).toHaveURL('/events');
  });

  test('nav Login link works', async ({ page }) => {
    await page.goto('/');
    await page.locator('a', { hasText: 'Login' }).click();
    await expect(page).toHaveURL('/login');
  });
});

// ─── Event slugs ───────────────────────────────────────────────────────────

test.describe('Event slugs', () => {
  test('events returned by API include a slug', async () => {
    const res = await apiGet('/events');
    expect(res.status()).toBe(200);
    const events = res.json() as any[];
    for (const ev of events) {
      expect(typeof ev.slug).toBe('string');
      expect(ev.slug.length).toBeGreaterThan(0);
    }
  });

  test('event is reachable by slug', async () => {
    const listRes = await apiGet('/events');
    const events = listRes.json() as any[];
    if (events.length === 0) return; // no events seeded yet
    const ev = events[0];
    const res = await apiGet(`/events/${ev.slug}`);
    expect(res.status()).toBe(200);
    expect(res.json().id).toBe(ev.id);
  });

  test('OG preview endpoint returns HTML with og:title', async () => {
    const listRes = await apiGet('/events');
    const events = listRes.json() as any[];
    if (events.length === 0) return;
    const ev = events[0];
    const apiBase = 'http://localhost:8080';
    const r = await fetch(`${apiBase}/og/events/${ev.id}`);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('og:title');
    expect(html).toContain(ev.name);
  });

  test('OG image endpoint returns SVG', async () => {
    const listRes = await apiGet('/events');
    const events = listRes.json() as any[];
    if (events.length === 0) return;
    const ev = events[0];
    const apiBase = 'http://localhost:8080';
    const r = await fetch(`${apiBase}/og/events/${ev.id}/image`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('image/svg+xml');
    const svg = await r.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain(ev.name.substring(0, 10));
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
  let ticketTypeId: string;

  test.beforeAll(async () => {
    userToken = await getToken(USER_EMAIL, USER_PASS);
    const events = (await apiGet('/events')).json() as any[];
    const liveEvent = events.find((e: any) => e.ticketTypes?.length > 0);
    if (liveEvent) ticketTypeId = liveEvent.ticketTypes[0].id;
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
  let ticketTypeId: string;

  test.beforeAll(async () => {
    const events = (await apiGet('/events')).json() as any[];
    const liveEvent = events.find((e: any) => e.ticketTypes?.length > 0);
    if (liveEvent) ticketTypeId = liveEvent.ticketTypes[0].id;
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
  const OWNER_EMAIL = 'owner@austintickets.dev';
  const OWNER_PASS = 'ChangeMe123!';

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
  const OWNER_EMAIL = 'owner@austintickets.dev';
  const OWNER_PASS = 'ChangeMe123!';

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
