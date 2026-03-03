import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';

@customElement('page-checkout')
export class PageCheckout extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 520px; margin: 0 auto; }
    .back { color: #8888a8; cursor: pointer; font-size: 0.9rem; margin-bottom: 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .back:hover { color: #fff; }

    /* Event header */
    .event-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid #2e2e4e; border-radius: 16px;
      padding: 1.5rem; margin-bottom: 1.5rem;
    }
    .event-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #6c63ff; font-weight: 700; margin-bottom: 0.5rem; }
    .event-name { font-size: 1.4rem; font-weight: 900; margin-bottom: 0.5rem; line-height: 1.2; }
    .event-meta { display: flex; flex-direction: column; gap: 0.25rem; }
    .event-meta span { font-size: 0.85rem; color: #8888a8; display: flex; align-items: center; gap: 0.4rem; }

    /* Order items */
    .section-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #555568; font-weight: 700; margin-bottom: 0.75rem; }
    .items { display: flex; flex-direction: column; gap: 0; margin-bottom: 1.5rem; }
    .item-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.9rem 0; border-bottom: 1px solid #1e1e2e;
    }
    .item-row:last-child { border-bottom: none; }
    .item-left { display: flex; flex-direction: column; gap: 0.15rem; }
    .item-name { font-weight: 600; font-size: 0.95rem; }
    .item-sub { font-size: 0.8rem; color: #8888a8; }
    .item-price { font-weight: 700; font-size: 0.95rem; }

    /* Totals block */
    .totals {
      background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 12px;
      padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    .total-row { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem; color: #aaa; }
    .total-row:last-child { margin-bottom: 0; }
    .total-row.grand {
      font-size: 1.15rem; font-weight: 900; color: #f0f0f8;
      border-top: 1px solid #2e2e3e; padding-top: 0.75rem; margin-top: 0.5rem;
    }

    /* Timer */
    .expire {
      background: #451a03; border: 1px solid #78350f; border-radius: 10px;
      padding: 0.75rem 1rem; font-size: 0.85rem; color: #fbbf24;
      margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;
    }

    /* CTA */
    .cta-area { display: flex; flex-direction: column; gap: 0.75rem; }
    .btn-pay {
      width: 100%; background: #6c63ff; color: #fff;
      padding: 1rem; border-radius: 12px; font-weight: 800;
      font-size: 1.05rem; cursor: pointer; border: none;
      font-family: inherit; transition: background 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
    .btn-pay:hover:not(:disabled) { background: #5a52e0; }
    .btn-pay:disabled { opacity: 0.4; cursor: not-allowed; }
    .secure-note { text-align: center; font-size: 0.78rem; color: #555568; }

    /* Success */
    .success { text-align: center; padding: 3rem 2rem; }
    .success .icon { font-size: 4rem; margin-bottom: 1rem; }
    .success h2 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem; }
    .success p { color: #8888a8; margin-bottom: 2rem; }
    .btn { width: 100%; background: #6c63ff; color: #fff; padding: 0.9rem; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; border: none; font-family: inherit; }

    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 1rem; color: #fca5a5; margin-bottom: 1rem; }
    @media (max-width: 640px) {
      :host { padding: 1rem; }
      .event-name { font-size: 1.2rem; }
    }
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
      await api.createCheckout(this.orderId);
      this.paid = true;
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.paying = false;
    }
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
    const subtotal: number = o?.totalAmount ?? 0;
    const platformFee: number = o?.platformFee ?? 0;
    const processingFee = parseFloat((subtotal * 0.03).toFixed(2));
    const grandTotal = (subtotal + platformFee + processingFee).toFixed(2);

    // Group tickets by ticket type
    const grouped: Record<string, { name: string; price: number; qty: number }> = {};
    for (const t of tickets) {
      const id = t.ticketType?.id ?? 'unknown';
      if (!grouped[id]) grouped[id] = { name: t.ticketType?.name ?? 'Ticket', price: t.ticketType?.price ?? 0, qty: 0 };
      grouped[id].qty++;
    }

    return html`
      <div class="back" @click=${() => navigate('/events')}>← Back to Events</div>

      ${event ? html`
        <div class="event-header">
          <div class="event-label">Your Order</div>
          <div class="event-name">${event.name}</div>
          <div class="event-meta">
            ${event.startsAt ? html`<span>📅 ${new Date(event.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>` : ''}
            ${event.venue?.name ? html`<span>📍 ${event.venue.name}</span>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="section-label">Items</div>
      <div class="items">
        ${Object.values(grouped).map(g => html`
          <div class="item-row">
            <div class="item-left">
              <div class="item-name">${g.name}</div>
              <div class="item-sub">${g.qty} × $${g.price.toFixed(2)}</div>
            </div>
            <div class="item-price">$${(g.qty * g.price).toFixed(2)}</div>
          </div>
        `)}
      </div>

      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
        ${platformFee > 0 ? html`
          <div class="total-row"><span>💜 Platform contribution</span><span>$${platformFee.toFixed(2)}</span></div>
        ` : ''}
        <div class="total-row"><span>Processing fee (~3%)</span><span>$${processingFee.toFixed(2)}</span></div>
        <div class="total-row grand"><span>Total</span><span>$${grandTotal}</span></div>
      </div>

      <div class="expire">⏱ Reserved for 15 minutes — complete payment before your order expires.</div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}

      <div class="cta-area">
        <button class="btn-pay" ?disabled=${this.paying} @click=${this._pay}>
          ${this.paying
            ? html`<span>Processing…</span>`
            : html`<span>🔒</span><span>Pay $${grandTotal} with Stripe</span>`}
        </button>
        <div class="secure-note">Secured by Stripe · PCI-compliant · No hidden fees</div>
      </div>
    `;
  }
}
