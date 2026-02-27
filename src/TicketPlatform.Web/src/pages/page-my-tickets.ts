import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

@customElement('page-my-tickets')
export class PageMyTickets extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 2rem; }
    .ticket-card {
      background: linear-gradient(135deg, #1a1a24 0%, #22203a 100%);
      border: 1px solid #2e2e3e;
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    .ticket-card::before {
      content: '';
      position: absolute;
      left: -1px; top: 50%;
      transform: translateY(-50%);
      width: 3px; height: 60%;
      background: #6c63ff;
      border-radius: 0 3px 3px 0;
    }
    .event-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .event-date { font-size: 0.85rem; color: #8888a8; margin-bottom: 0.5rem; }
    .ticket-type { font-size: 0.9rem; color: #a5b4fc; margin-bottom: 1rem; }
    .status-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .qr-section { text-align: center; }
    .qr-icon { font-size: 3rem; }
    .qr-label { font-size: 0.75rem; color: #8888a8; margin-top: 0.25rem; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-paid { background: #14532d; color: #22c55e; }
    .badge-pending { background: #451a03; color: #f59e0b; }
    .badge-cancelled { background: #450a0a; color: #ef4444; }
    .badge-checked { background: #1e1b4b; color: #818cf8; }
    .empty { text-align: center; padding: 5rem; color: #8888a8; }
    .empty div { font-size: 3rem; margin-bottom: 1rem; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .btn-browse {
      background: #6c63ff;
      color: #fff;
      padding: 0.75rem 2rem;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      font-family: inherit;
      margin-top: 1rem;
      font-size: 0.95rem;
    }
    .qr-token-box {
      background: #fff;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.6rem;
      color: #111;
      word-break: break-all;
      max-width: 140px;
      text-align: center;
    }
  `;

  @state() orders: any[] = [];
  @state() loading = true;

  async connectedCallback() {
    super.connectedCallback();
    if (!auth.isLoggedIn) {
      navigate('/login');
      return;
    }
    try {
      this.orders = await api.getOrders();
    } finally {
      this.loading = false;
    }
  }

  private _statusBadge(status: string) {
    const map: Record<string, string> = {
      Paid: 'badge-paid', Pending: 'badge-pending', AwaitingPayment: 'badge-pending',
      Cancelled: 'badge-cancelled', Refunded: 'badge-cancelled',
    };
    return map[status] ?? 'badge-pending';
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading tickets…</div>`;
    const allTickets = this.orders.flatMap((o: any) =>
      (o.tickets ?? []).map((t: any) => ({ ...t, order: o }))
    );

    return html`
      <h1>My Tickets</h1>
      ${allTickets.length === 0 ? html`
        <div class="empty">
          <div>🎟</div>
          <p>No tickets yet.</p>
          <button class="btn-browse" @click=${() => navigate('/events')}>Browse Events</button>
        </div>
      ` : allTickets.map((t: any) => {
        const ev = t.ticketType?.event;
        return html`
          <div class="ticket-card">
            <div>
              <div class="event-name">${ev?.name ?? 'Event'}</div>
              <div class="event-date">📅 ${ev ? new Date(ev.startsAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : ''}</div>
              <div class="ticket-type">🎫 ${t.ticketType?.name}</div>
              <div class="status-row">
                <span class="badge ${this._statusBadge(t.order.status)}">${t.order.status}</span>
                ${t.status === 'CheckedIn' ? html`<span class="badge badge-checked">✓ Checked In</span>` : ''}
              </div>
            </div>
            <div class="qr-section">
              ${t.qrToken ? html`
                <div class="qr-token-box">${t.qrToken.substring(0, 40)}…</div>
                <div class="qr-label">Show at door</div>
              ` : html`
                <div class="qr-icon">🔒</div>
                <div class="qr-label">Pending payment</div>
              `}
            </div>
          </div>
        `;
      })}
    `;
  }
}
