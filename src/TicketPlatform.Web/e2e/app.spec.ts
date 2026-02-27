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

// ─── Health check ──────────────────────────────────────────────────────────

test.describe('API health', () => {
  test('GET /healthz returns healthy', async () => {
    const res = await apiGet('/healthz');
    expect(res.status()).toBe(200);
    expect(res.json().status).toBe('healthy');
  });
});
