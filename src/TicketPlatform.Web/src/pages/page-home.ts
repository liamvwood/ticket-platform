import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

@customElement('page-home')
export class PageHome extends LitElement {
  static styles = css`
    :host { display: block; }
    .hero {
      min-height: 88vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, #2d1f6e44, transparent);
    }
    .eyebrow {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #818cf8;
      margin-bottom: 1.25rem;
      background: #1e1b4b;
      padding: 0.35rem 1.1rem;
      border-radius: 999px;
      border: 1px solid #3730a3;
    }
    h1 {
      font-size: clamp(2.5rem, 6vw, 5rem);
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 1.5rem;
    }
    h1 .accent { color: #6c63ff; }
    .sub {
      font-size: 1.15rem;
      color: #8888a8;
      max-width: 560px;
      margin: 0 auto 2.5rem;
      line-height: 1.7;
    }
    .cta-row { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: #6c63ff;
      color: #fff;
      padding: 0.85rem 2.2rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: all 0.2s;
    }
    .btn-primary:hover { background: #5a52e0; transform: translateY(-2px); box-shadow: 0 8px 24px #6c63ff44; }
    .btn-ghost {
      background: transparent;
      color: #ccc;
      padding: 0.85rem 2.2rem;
      border-radius: 10px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      border: 1px solid #2e2e3e;
      font-family: inherit;
      transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: #555; color: #fff; }
    .stats {
      display: flex;
      gap: 3rem;
      justify-content: center;
      margin-top: 5rem;
      flex-wrap: wrap;
    }
    .stat { text-align: center; }
    .stat-val { font-size: 2.2rem; font-weight: 900; color: #fff; }
    .stat-label { font-size: 0.82rem; color: #8888a8; margin-top: 0.25rem; }
    .features {
      padding: 5rem 2rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .features h2 {
      text-align: center;
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 3rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
    }
    .feature-card {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 14px;
      padding: 2rem;
      transition: border-color 0.2s;
    }
    .feature-card:hover { border-color: #6c63ff44; }
    .feature-icon {
      width: 48px;
      height: 48px;
      background: #1e1b4b;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: #818cf8;
    }
    .feature-card h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem; }
    .feature-card p { color: #8888a8; font-size: 0.88rem; line-height: 1.7; }
    .fee-banner {
      background: linear-gradient(135deg, #1e1b4b, #2d1f6e);
      border: 1px solid #3730a3;
      border-radius: 20px;
      padding: 3.5rem;
      text-align: center;
      max-width: 700px;
      margin: 4rem auto;
    }
    .fee-banner h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.75rem; }
    .fee-banner p { color: #a5b4fc; font-size: 1rem; margin-bottom: 2rem; }
    .fee-compare { display: flex; gap: 3rem; justify-content: center; flex-wrap: wrap; }
    .fee-item { text-align: center; }
    .fee-pct { font-size: 2.4rem; font-weight: 900; }
    .fee-pct.them { color: #f87171; }
    .fee-pct.us { color: #4ade80; }
    .fee-name { font-size: 0.82rem; color: #8888a8; margin-top: 0.3rem; }
    .fee-divider { width: 1px; background: #3730a3; align-self: stretch; }
  `;

  render() {
    return html`
      <div class="hero">
        <div class="eyebrow">Austin's Local Ticket Platform</div>
        <h1>Tickets that don't<br><span class="accent">crash or scalp you</span></h1>
        <p class="sub">Buy tickets for Austin's best live music, comedy, and events — with transparent fees and zero bots.</p>
        <div class="cta-row">
          <button class="btn-primary" @click=${() => navigate('/events')}>Browse Events</button>
          <button class="btn-ghost" @click=${() => navigate('/register')}>Create Account</button>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat-val">~3%</div><div class="stat-label">Service Fee</div></div>
          <div class="stat"><div class="stat-val">0</div><div class="stat-label">Crashes at Drop</div></div>
          <div class="stat"><div class="stat-val">Live</div><div class="stat-label">QR Validation</div></div>
          <div class="stat"><div class="stat-val">ATX</div><div class="stat-label">Local First</div></div>
        </div>
      </div>

      <div class="features">
        <h2>Everything a local venue needs</h2>
        <div class="grid">
          <div class="feature-card">
            <div class="feature-icon" .innerHTML=${icons.bolt}></div>
            <h3>Drop-Ready</h3>
            <p>Queue-buffered architecture handles sold-out releases without a sweat. Pre-scaled before every drop.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" .innerHTML=${icons.wallet}></div>
            <h3>Digital Wallet</h3>
            <p>Add tickets to Apple or Google Wallet. Show your QR at the door — no screenshot games.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" .innerHTML=${icons.shield}></div>
            <h3>Anti-Scalping</h3>
            <p>Phone verification, per-account limits, rate limiting, and identity-bound tickets.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" .innerHTML=${icons.chart}></div>
            <h3>Venue Analytics</h3>
            <p>Real-time sales dashboards, CSV exports, and payout tracking — all in one portal.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" .innerHTML=${icons.scan}></div>
            <h3>Fast Scanning</h3>
            <p>Camera-based QR scanner with instant Valid / Duplicate / Refunded feedback.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" .innerHTML=${icons.card}></div>
            <h3>Stripe Payments</h3>
            <p>PCI-compliant Stripe checkout. Idempotent orders, refunds, and venue payouts built in.</p>
          </div>
        </div>

        <div class="fee-banner">
          <h2>Transparent pricing</h2>
          <p>We charge what's fair. No hidden fees buried in checkout.</p>
          <div class="fee-compare">
            <div class="fee-item">
              <div class="fee-pct them">~27%</div>
              <div class="fee-name">Ticketmaster</div>
            </div>
            <div class="fee-divider"></div>
            <div class="fee-item">
              <div class="fee-pct them">~15%</div>
              <div class="fee-name">Eventbrite</div>
            </div>
            <div class="fee-divider"></div>
            <div class="fee-item">
              <div class="fee-pct us">~3%</div>
              <div class="fee-name">Austin Tickets</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
