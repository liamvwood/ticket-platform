import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

@customElement('page-event-detail')
export class PageEventDetail extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 900px; margin: 0 auto; }
    .back { color: #8888a8; cursor: pointer; font-size: 0.9rem; margin-bottom: 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .back:hover { color: #fff; }
    .header { margin-bottom: 2rem; }
    .header h1 { font-size: 2.2rem; font-weight: 900; margin-bottom: 0.5rem; }
    .meta { display: flex; gap: 1.5rem; flex-wrap: wrap; color: #8888a8; font-size: 0.9rem; margin-bottom: 1rem; }
    .meta span { display: flex; align-items: center; gap: 0.4rem; }
    .desc { color: #aaa; line-height: 1.8; margin-bottom: 2rem; }
    h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 1rem; }
    .ticket-types { display: flex; flex-direction: column; gap: 1rem; }
    .tt-row {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .tt-info h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .tt-info p { font-size: 0.85rem; color: #8888a8; }
    .tt-right { display: flex; align-items: center; gap: 1.5rem; }
    .price { font-size: 1.4rem; font-weight: 800; color: #22c55e; }
    .avail { font-size: 0.8rem; color: #8888a8; }
    .qty-row { display: flex; align-items: center; gap: 0.5rem; }
    .qty-btn { background: #2e2e3e; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .qty-btn:hover { background: #3e3e5e; }
    .qty { font-weight: 700; min-width: 24px; text-align: center; }
    .btn {
      background: #6c63ff;
      color: #fff;
      padding: 0.6rem 1.4rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .btn:hover { background: #5a52e0; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .sold-out { color: #ef4444; font-weight: 700; font-size: 0.9rem; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 1rem; color: #fca5a5; }
    .toast {
      position: fixed; bottom: 2rem; right: 2rem;
      background: #1e3a1e; border: 1px solid #22c55e;
      color: #22c55e; padding: 0.75rem 1.5rem;
      border-radius: 10px; font-weight: 600; z-index: 999;
    }
  `;

  @property() eventId = '';
  @state() event: any = null;
  @state() loading = true;
  @state() error = '';
  @state() quantities: Record<string, number> = {};
  @state() ordering: Record<string, boolean> = {};
  @state() toast = '';

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.event = await api.getEvent(this.eventId);
      const q: Record<string, number> = {};
      this.event?.ticketTypes?.forEach((tt: any) => { q[tt.id] = 1; });
      this.quantities = q;
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  private _setQty(ttId: string, delta: number, max: number) {
    const cur = this.quantities[ttId] ?? 1;
    this.quantities = { ...this.quantities, [ttId]: Math.max(1, Math.min(max, cur + delta)) };
  }

  private async _buy(tt: any) {
    if (!auth.isLoggedIn) { navigate('/login'); return; }
    this.ordering = { ...this.ordering, [tt.id]: true };
    try {
      const order = await api.createOrder(tt.id, this.quantities[tt.id] ?? 1);
      navigate(`/checkout/${order.id}`);
    } catch (e: any) {
      this.toast = e.message;
      setTimeout(() => { this.toast = ''; }, 4000);
    } finally {
      this.ordering = { ...this.ordering, [tt.id]: false };
    }
  }

  private _available(tt: any) {
    return tt.totalQuantity - tt.quantitySold;
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading event…</div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;
    const ev = this.event;
    return html`
      <div class="back" @click=${() => navigate('/events')}>← Back to Events</div>
      <div class="header">
        <h1>${ev.name}</h1>
        <div class="meta">
          <span>📍 ${ev.venue?.name ?? 'Austin, TX'}</span>
          <span>📅 ${new Date(ev.startsAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
        </div>
        <p class="desc">${ev.description}</p>
      </div>

      <h2>Tickets</h2>
      <div class="ticket-types">
        ${ev.ticketTypes?.map((tt: any) => {
          const avail = this._available(tt);
          const qty = this.quantities[tt.id] ?? 1;
          return html`
            <div class="tt-row">
              <div class="tt-info">
                <h3>${tt.name}</h3>
                <p>Max ${tt.maxPerOrder} per order · ${avail > 0 ? `${avail} left` : 'Sold out'}</p>
              </div>
              <div class="tt-right">
                <div class="price">$${tt.price.toFixed(2)}</div>
                ${avail > 0 ? html`
                  <div class="qty-row">
                    <button class="qty-btn" @click=${() => this._setQty(tt.id, -1, tt.maxPerOrder)}>−</button>
                    <span class="qty">${qty}</span>
                    <button class="qty-btn" @click=${() => this._setQty(tt.id, 1, tt.maxPerOrder)}>+</button>
                  </div>
                  <button class="btn" ?disabled=${this.ordering[tt.id]} @click=${() => this._buy(tt)}>
                    ${this.ordering[tt.id] ? 'Processing…' : `Buy · $${(tt.price * qty).toFixed(2)}`}
                  </button>
                ` : html`<div class="sold-out">Sold Out</div>`}
              </div>
            </div>
          `;
        })}
      </div>

      ${this.toast ? html`<div class="toast">${this.toast}</div>` : ''}
    `;
  }
}
