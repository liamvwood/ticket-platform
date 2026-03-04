/**
 * Mobile screenshot suite — captures every page at iPhone 14 Pro viewport.
 * Saves PNGs to e2e/screenshots/mobile/
 *
 * Run: npx playwright test e2e/mobile-screenshots.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.E2E_API_URL ?? 'http://localhost:8080';
const OWNER_EMAIL = 'owner@slingshot.dev';
const OWNER_PASS = 'ChangeMe123!';
const VENUE_EMAIL = 'venue@slingshot.dev';
const VENUE_PASS = 'Password123!';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
// __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'mobile');

async function getToken(email: string, pass: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  const json = await res.json().catch(() => ({}));
  return json.token ?? '';
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.use({ viewport: MOBILE_VIEWPORT });

test.beforeAll(() => { ensureDir(SCREENSHOT_DIR); });

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function loginAs(page: import('@playwright/test').Page, email: string, pass: string, role: string) {
  const token = await getToken(email, pass);
  await page.goto('/');
  await page.evaluate(([t, e, r]) => {
    localStorage.setItem('jwt', t);
    localStorage.setItem('userEmail', e);
    localStorage.setItem('userRole', r);
    window.dispatchEvent(new Event('auth-change'));
  }, [token, email, role]);
}

// ─── Public pages ───────────────────────────────────────────────────────────

test('screenshot: home page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, '01-home');
});

test('screenshot: events list', async ({ page }) => {
  await page.goto('/events');
  await page.waitForLoadState('networkidle');
  await shot(page, '02-events');
});

test('screenshot: event detail (first published event)', async ({ page }) => {
  const res = await fetch(`${API}/events?page=1&pageSize=1`);
  const body = await res.json().catch(() => ({ items: [] }));
  const events = body.items ?? body;
  if (!Array.isArray(events) || events.length === 0) {
    await page.goto('/events');
    await shot(page, '03-event-detail-fallback');
    return;
  }
  const ev = events[0];
  await page.goto(`/events/${ev.slug}`);
  await page.waitForLoadState('networkidle');
  await shot(page, '03-event-detail');
});

test('screenshot: login page', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await shot(page, '04-login');
});

test('screenshot: register page', async ({ page }) => {
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await shot(page, '05-register');
});

test('screenshot: my tickets (authenticated user)', async ({ page }) => {
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto('/my-tickets');
  await page.waitForLoadState('networkidle');
  await shot(page, '06-my-tickets');
});

// ─── Venue admin / owner pages ──────────────────────────────────────────────

test('screenshot: venue dashboard (AppOwner)', async ({ page }) => {
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto('/venue');
  await page.waitForLoadState('networkidle');
  await shot(page, '07-venue-dashboard-owner');
});

test('screenshot: venue dashboard (VenueAdmin)', async ({ page }) => {
  await loginAs(page, VENUE_EMAIL, VENUE_PASS, 'VenueAdmin');
  await page.goto('/venue');
  await page.waitForLoadState('networkidle');
  await shot(page, '08-venue-dashboard-admin');
});

test('screenshot: create event page', async ({ page }) => {
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto('/venue/events/new');
  await page.waitForLoadState('networkidle');
  await shot(page, '09-new-event-step1');
});

test('screenshot: scanner page (AppOwner)', async ({ page }) => {
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto('/scan');
  await page.waitForLoadState('networkidle');
  await shot(page, '10-scanner-owner');
});

test('screenshot: scanner page (VenueAdmin)', async ({ page }) => {
  await loginAs(page, VENUE_EMAIL, VENUE_PASS, 'VenueAdmin');
  await page.goto('/scan');
  await page.waitForLoadState('networkidle');
  await shot(page, '11-scanner-admin');
});

test('screenshot: admin invites page', async ({ page }) => {
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto('/admin/invites');
  await page.waitForLoadState('networkidle');
  await shot(page, '12-admin-invites');
});

test('screenshot: manage event page', async ({ page }) => {
  const token = await getToken(OWNER_EMAIL, OWNER_PASS);
  // Fetch first event for the owner
  const res = await fetch(`${API}/events/admin?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({ items: [] }));
  const events = body.items ?? [];
  if (events.length === 0) {
    test.skip(true, 'No events available for manage-event screenshot');
    return;
  }
  const ev = events[0];
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto(`/venue/events/${ev.id}`);
  await page.waitForLoadState('networkidle');
  await shot(page, '13-manage-event');
});

test('screenshot: checkout page', async ({ page }) => {
  const res = await fetch(`${API}/events?page=1&pageSize=1`);
  const body = await res.json().catch(() => ({ items: [] }));
  const events = body.items ?? body;
  if (!Array.isArray(events) || events.length === 0) return;
  const ev = events[0];
  if (!ev.ticketTypes || ev.ticketTypes.length === 0) return;
  const ttId = ev.ticketTypes[0].id;
  await loginAs(page, OWNER_EMAIL, OWNER_PASS, 'AppOwner');
  await page.goto(`/checkout?ticketTypeId=${ttId}&quantity=1`);
  await page.waitForLoadState('networkidle');
  await shot(page, '14-checkout');
});
