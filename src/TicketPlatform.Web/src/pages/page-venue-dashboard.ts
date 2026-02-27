import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';

@customElement('page-venue-dashboard')
export class PageVenueDashboard extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
    .sub { color: #8888a8; margin-bottom: 2.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
    .stat-card { background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 12px; padding: 1.5rem; }
    .stat-label { font-size: 0.8rem; color: #8888a8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
    .stat-val { font-size: 2rem; font-weight: 900; }
    .stat-val.green { color: #22c55e; }
    .stat-val.purple { color: #818cf8; }
    .stat-val.orange { color: #f59e0b; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-header h2 { font-size: 1.3rem; font-weight: 700; }
    .btn {
      background: #6c63ff;
      color: #fff;
      padding: 0.55rem 1.2rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
    }
    .btn:hover { background: #5a52e0; }
    .btn-ghost {
      background: transparent;
      border: 1px solid #2e2e3e;
      color: #ccc;
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-ghost:hover { border-color: #555; color: #fff; }
    table { width: 100%; border-collapse: collapse; }
    thead th { text-align: left; font-size: 0.8rem; color: #8888a8; padding: 0.75rem 1rem; border-bottom: 1px solid #2e2e3e; text-transform: uppercase; letter-spacing: 0.05em; }
    tbody td { padding: 1rem; border-bottom: 1px solid #1e1e2e; font-size: 0.9rem; }
    tbody tr:hover td { background: #1e1e2e; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .badge-pub { background: #14532d; color: #22c55e; }
    .badge-draft { background: #1e1e2e; color: #8888a8; }
    .progress-bar { background: #2e2e3e; border-radius: 999px; height: 6px; margin-top: 4px; }
    .progress-fill { background: #6c63ff; border-radius: 999px; height: 6px; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .empty-row td { text-align: center; color: #8888a8; padding: 3rem; }
  `;

  @state() events: any[] = [];
  @state() loading = true;

  async connectedCallback() {
    super.connectedCallback();
    try { this.events = await api.getEvents(); }
    finally { this.loading = false; }
  }

  private _totalTickets() { return this.events.reduce((s, e) => s + (e.ticketTypes?.reduce((ss: number, tt: any) => ss + tt.totalQuantity, 0) ?? 0), 0); }
  private _totalSold() { return this.events.reduce((s, e) => s + (e.ticketTypes?.reduce((ss: number, tt: any) => ss + tt.quantitySold, 0) ?? 0), 0); }
  private _totalRevenue() { return this.events.reduce((s, e) => s + (e.ticketTypes?.reduce((ss: number, tt: any) => ss + tt.quantitySold * tt.price, 0) ?? 0), 0); }

  render() {
    if (this.loading) return html`<div class="loading">Loading…</div>`;
    const sold = this._totalSold();
    const tickets = this._totalTickets();
    const revenue = this._totalRevenue();
    return html`
      <h1>Venue Portal</h1>
      <p class="sub">Manage your events and track sales.</p>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Total Revenue</div>
          <div class="stat-val green">$${revenue.toFixed(0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tickets Sold</div>
          <div class="stat-val purple">${sold}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Capacity</div>
          <div class="stat-val">${tickets}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Events</div>
          <div class="stat-val orange">${this.events.length}</div>
        </div>
      </div>

      <div class="section-header">
        <h2>Events</h2>
        <div style="display:flex;gap:.75rem">
          <button class="btn-ghost" @click=${() => navigate('/scan')}>🔍 Scanner</button>
          <button class="btn" @click=${() => navigate('/venue/events/new')}>+ New Event</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Date</th>
            <th>Status</th>
            <th>Sold / Total</th>
            <th>Revenue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.events.length === 0 ? html`<tr class="empty-row"><td colspan="6">No events yet — create one to get started.</td></tr>` :
            this.events.map(ev => {
              const tTypes = ev.ticketTypes ?? [];
              const evSold = tTypes.reduce((s: number, tt: any) => s + tt.quantitySold, 0);
              const evTotal = tTypes.reduce((s: number, tt: any) => s + tt.totalQuantity, 0);
              const evRev = tTypes.reduce((s: number, tt: any) => s + tt.quantitySold * tt.price, 0);
              const pct = evTotal ? Math.round(evSold / evTotal * 100) : 0;
              return html`
                <tr>
                  <td><strong>${ev.name}</strong></td>
                  <td>${new Date(ev.startsAt).toLocaleDateString()}</td>
                  <td><span class="badge ${ev.isPublished ? 'badge-pub' : 'badge-draft'}">${ev.isPublished ? 'Published' : 'Draft'}</span></td>
                  <td>
                    ${evSold} / ${evTotal}
                    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                  </td>
                  <td>$${evRev.toFixed(2)}</td>
                  <td><button class="btn-ghost" @click=${() => navigate(`/venue/events/${ev.id}`)}>Manage</button></td>
                </tr>
              `;
            })
          }
        </tbody>
      </table>
    `;
  }
}
