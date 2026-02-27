import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';

@customElement('page-checkout')
export class PageCheckout extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 560px; margin: 0 auto; }
    .back { color: #8888a8; cursor: pointer; font-size: 0.9rem; margin-bottom: 2rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .back:hover { color: #fff; }
    h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 2rem; }
    .summary {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .summary h2 { font-size: 1rem; color: #8888a8; font-weight: 600; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .line { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem; }
    .line.total { font-weight: 800; font-size: 1.1rem; border-top: 1px solid #2e2e3e; padding-top: 0.75rem; margin-top: 0.75rem; }
    .line .muted { color: #8888a8; }
    .expire {
      background: #451a03;
      border: 1px solid #78350f;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      color: #fbbf24;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn {
      width: 100%;
      background: #6c63ff;
      color: #fff;
      padding: 0.9rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
    }
    .btn:hover:not(:disabled) { background: #5a52e0; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .success {
      text-align: center;
      padding: 3rem 2rem;
    }
    .success .icon { font-size: 4rem; margin-bottom: 1rem; }
    .success h2 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem; }
    .success p { color: #8888a8; margin-bottom: 2rem; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 1rem; color: #fca5a5; margin-bottom: 1rem; }
    .note { font-size: 0.8rem; color: #8888a8; text-align: center; margin-top: 1rem; }
  `;

  @property() orderId = '';
  @state() order: any = null;
  @state() loading = true;
  @state() paying = false;
  @state() paid = false;
  @state() error = '';

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.order = await api.getOrder(this.orderId);
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  private async _pay() {
    this.paying = true;
    this.error = '';
    try {
      // In a real app we'd load the Stripe.js SDK and confirm with clientSecret.
      // For the MVP demo we simulate the checkout redirect.
      await api.createCheckout(this.orderId);
      // Simulate successful payment for demo (in prod: use Stripe.js confirmPayment)
      this.paid = true;
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.paying = false;
    }
  }

  private _fee(total: number) {
    return (total * 0.03).toFixed(2);
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading order…</div>`;
    if (this.paid) return html`
      <div class="success">
        <div class="icon">🎉</div>
        <h2>You're going!</h2>
        <p>Your tickets have been confirmed. Check your wallet or the My Tickets page.</p>
        <button class="btn" @click=${() => navigate('/my-tickets')}>View My Tickets</button>
      </div>
    `;
    const o = this.order;
    const tickets = o?.tickets ?? [];
    const event = tickets[0]?.ticketType?.event;
    const subtotal = o?.totalAmount ?? 0;
    const fee = parseFloat(this._fee(subtotal));
    return html`
      <div class="back" @click=${() => navigate('/events')}>← Back to Events</div>
      <h1>Complete Purchase</h1>

      <div class="summary">
        <h2>Order Summary</h2>
        ${event ? html`<div class="line"><span>${event.name}</span></div>` : ''}
        ${tickets.map((t: any) => html`
          <div class="line">
            <span class="muted">${t.ticketType?.name}</span>
            <span>$${t.ticketType?.price?.toFixed(2)}</span>
          </div>
        `)}
        <div class="line"><span class="muted">Service fee (~3%)</span><span>$${fee.toFixed(2)}</span></div>
        <div class="line total"><span>Total</span><span>$${(subtotal + fee).toFixed(2)}</span></div>
      </div>

      <div class="expire">⏱ Reserved for 15 minutes — complete payment before your order expires.</div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      <button class="btn" ?disabled=${this.paying} @click=${this._pay}>
        ${this.paying ? 'Processing…' : `Pay $${(subtotal + fee).toFixed(2)} with Stripe`}
      </button>
      <p class="note">🔒 Secured by Stripe · PCI-compliant</p>
    `;
  }
}
