import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';

function getUserRole(): string {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? payload.role ?? '';
  } catch { return ''; }
}

@customElement('page-venue-dashboard')
export class PageVenueDashboard extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
    .sub { color: #6b7a8d; margin-bottom: 2.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
    .stat-card { background: #111820; border: 1px solid #1e2836; border-radius: 12px; padding: 1.5rem; }
    .stat-label { font-size: 0.8rem; color: #6b7a8d; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
    .stat-val { font-size: 2rem; font-weight: 900; }
    .stat-val.green { color: #22c55e; }
    .stat-val.purple { color: #00FF88; }
    .stat-val.orange { color: #f59e0b; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-header h2 { font-size: 1.3rem; font-weight: 700; }
    .btn {
      background: #00FF88;
      color: #0b0f14;
      padding: 0.55rem 1.2rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
    }
    .btn:hover { background: #00d474; }
    .btn-ghost {
      background: transparent;
      border: 1px solid #1e2836;
      color: #ccc;
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-ghost:hover { border-color: #555; color: #fff; }
    .owner-badge { background: #78350f22; color: #f59e0b; border: 1px solid #78350f; border-radius: 6px; padding: 0.2rem 0.7rem; font-size: 0.75rem; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    thead th { text-align: left; font-size: 0.8rem; color: #6b7a8d; padding: 0.75rem 1rem; border-bottom: 1px solid #1e2836; text-transform: uppercase; letter-spacing: 0.05em; }
    tbody td { padding: 1rem; border-bottom: 1px solid #1e1e2e; font-size: 0.9rem; }
    tbody tr:hover td { background: #1e1e2e; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .badge-pub { background: #14532d; color: #22c55e; }
    .badge-draft { background: #1e1e2e; color: #6b7a8d; }
    .progress-bar { background: #1e2836; border-radius: 999px; height: 6px; margin-top: 4px; }
    .progress-fill { background: #00FF88; border-radius: 999px; height: 6px; }
    .loading { text-align: center; padding: 5rem; color: #6b7a8d; }
    .empty-row td { text-align: center; color: #6b7a8d; padding: 3rem; }
    .pagination { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; justify-content: center; }
    .page-btn { background: #111820; border: 1px solid #1e2836; color: #ccc; padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
    .page-btn:hover:not(:disabled) { border-color: #00FF88; color: #00FF88; }
    .page-btn.active { background: #00FF88; border-color: #00FF88; color: #0b0f14; font-weight: 700; }
    .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    @media (max-width: 640px) {
      :host { padding: 1rem; }
      h1 { font-size: 1.4rem; }
      table { font-size: 0.82rem; }
      th, td { padding: 0.5rem 0.4rem; }
    }
  `;

  @state() events: any[] = [];
  @state() loading = true;
  @state() isOwner = false;
  @state() page = 1;
  @state() totalPages = 1;

  async connectedCallback() {
    super.connectedCallback();
    this.isOwner = getUserRole() === 'AppOwner';
    await this._loadPage(1);
  }

  private async _loadPage(page: number) {
    this.loading = true;
    try {
      const result = this.isOwner
        ? await api.getEventsAdmin(page, 20)
        : await api.getEvents(page, 20);
      if (result?.items) {
        this.events = result.items;
        this.page = result.page;
        this.totalPages = result.totalPages;
      } else {
        this.events = Array.isArray(result) ? result : [];
        this.totalPages = 1;
      }
    } finally { this.loading = false; }
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
      <h1>
        ${this.isOwner ? html`Platform Overview <span class="owner-badge">App Owner</span>` : 'Venue Portal'}
      </h1>
      <p class="sub">${this.isOwner ? 'Manage all events across the platform.' : 'Manage your events and track sales.'}</p>

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
        <h2>${this.isOwner ? 'All Events' : 'Events'}</h2>
        <div style="display:flex;gap:.75rem">
          <button class="btn-ghost" @click=${() => navigate('/scan')}>🔍 Scanner</button>
          <button class="btn" @click=${() => navigate('/venue/events/new')}>+ New Event</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Event</th>
            ${this.isOwner ? html`<th>Venue</th>` : ''}
            <th>Date</th>
            <th>Status</th>
            <th>Sold / Total</th>
            <th>Revenue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.events.length === 0
            ? html`<tr class="empty-row"><td colspan="${this.isOwner ? 7 : 6}">No events yet — create one to get started.</td></tr>`
            : this.events.map(ev => {
                const tTypes = ev.ticketTypes ?? [];
                const evSold = tTypes.reduce((s: number, tt: any) => s + tt.quantitySold, 0);
                const evTotal = tTypes.reduce((s: number, tt: any) => s + tt.totalQuantity, 0);
                const evRev = tTypes.reduce((s: number, tt: any) => s + tt.quantitySold * tt.price, 0);
                const pct = evTotal ? Math.round(evSold / evTotal * 100) : 0;
                return html`
                  <tr>
                    <td><strong>${ev.name}</strong></td>
                    ${this.isOwner ? html`<td>${ev.venue?.name ?? '—'}</td>` : ''}
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
      ${this.totalPages > 1 ? html`
        <div class="pagination">
          <button class="page-btn" ?disabled=${this.page <= 1} @click=${() => this._loadPage(this.page - 1)}>‹</button>
          ${Array.from({ length: this.totalPages }, (_, i) => i + 1).map(p => html`
            <button class="page-btn ${p === this.page ? 'active' : ''}" @click=${() => this._loadPage(p)}>${p}</button>
          `)}
          <button class="page-btn" ?disabled=${this.page >= this.totalPages} @click=${() => this._loadPage(this.page + 1)}>›</button>
        </div>
      ` : ''}
    `;
  }
}

