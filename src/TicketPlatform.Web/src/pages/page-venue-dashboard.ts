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
    .admin-bar {
      background: linear-gradient(90deg, #FF5A1F22, #FF5A1F11);
      border: 1px solid #FF5A1F55;
      border-radius: 10px;
      padding: 0.6rem 1.2rem;
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 2rem;
      font-size: 0.85rem; color: #FF5A1F; font-weight: 600;
    }
    .admin-bar-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF5A1F; flex-shrink: 0; }
    .share-modal-overlay {
      position: fixed; inset: 0; background: #0009; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .share-modal {
      background: #111820; border: 1px solid #1e2836; border-radius: 20px;
      padding: 2rem; max-width: 400px; width: 90%;
    }
    .share-modal h3 { font-size: 1.15rem; font-weight: 800; margin-bottom: 0.25rem; }
    .share-modal .event-name-sm { color: #6b7a8d; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .share-btns { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
    .share-btn {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.1rem;
      border-radius: 10px; cursor: pointer; font-family: inherit; font-weight: 600;
      font-size: 0.9rem; border: 1px solid #1e2836; background: #1a2435;
      color: #F5F5F5; text-decoration: none; transition: border-color 0.2s, background 0.2s;
    }
    .share-btn:hover { border-color: #00FF88; background: #0d1a15; }
    .share-btn.copy { background: #0d1a15; border-color: #00FF8844; }
    .share-modal-close {
      width: 100%; background: transparent; border: 1px solid #1e2836;
      color: #6b7a8d; padding: 0.65rem; border-radius: 8px;
      cursor: pointer; font-family: inherit; font-size: 0.85rem;
    }
    .share-modal-close:hover { border-color: #555; color: #ccc; }
    .recurring-badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      background: #0d1a15; border: 1px solid #00FF8833; color: #00FF88;
      border-radius: 999px; padding: 0.1rem 0.5rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; margin-left: 0.5rem; vertical-align: middle;
    }
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
  @state() shareEvent: any = null;
  @state() copiedLink = false;

  async connectedCallback() {
    super.connectedCallback();
    this.isOwner = getUserRole() === 'AppOwner';
    await this._loadPage(1);
  }

  private async _loadPage(page: number) {
    this.loading = true;
    try {
      const t0 = performance.now();
      const result = this.isOwner
        ? await api.getEventsAdmin(page, 20)
        : await api.getEvents({ page, pageSize: 20 });
      const elapsed = performance.now() - t0;
      console.info(`[perf] venue-dashboard load: ${elapsed.toFixed(0)}ms`);
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

  private _openShare(ev: any) { this.shareEvent = ev; this.copiedLink = false; }
  private _closeShare() { this.shareEvent = null; }
  private _eventUrl(ev: any) { return window.location.origin + '/events/' + (ev.slug ?? ev.id); }
  private async _copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    this.copiedLink = true;
    setTimeout(() => { this.copiedLink = false; this.requestUpdate(); }, 2000);
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading...</div>`;
    const sold = this._totalSold();
    const tickets = this._totalTickets();
    const revenue = this._totalRevenue();
    return html`
      <div class="admin-bar">
        <div class="admin-bar-dot"></div>
        ${this.isOwner ? '⚙ App Owner — Platform Administration' : '⚙ Admin Area — Venue Portal'}
      </div>

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
                    <td>
                      <strong>${ev.name}</strong>
                      ${ev.recurringRule ? html`<span class="recurring-badge">↻ ${ev.recurringRule.charAt(0) + ev.recurringRule.slice(1).toLowerCase()}</span>` : ''}
                    </td>
                    ${this.isOwner ? html`<td>${ev.venue?.name ?? '—'}</td>` : ''}
                    <td>${new Date(ev.startsAt).toLocaleDateString()}</td>
                    <td><span class="badge ${ev.isPublished ? 'badge-pub' : 'badge-draft'}">${ev.isPublished ? 'Published' : 'Draft'}</span></td>
                    <td>
                      ${evSold} / ${evTotal}
                      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                    </td>
                    <td>$${evRev.toFixed(2)}</td>
                    <td style="display:flex;gap:.5rem;align-items:center">
                      <button class="btn-ghost" @click=${() => this._openShare(ev)} title="Share">📤</button>
                      <button class="btn-ghost" @click=${() => navigate(`/venue/events/${ev.id}`)}>Manage</button>
                    </td>
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

      ${this.shareEvent ? this._renderShareModal(this.shareEvent) : ''}
    `;
  }

  private _renderShareModal(ev: any) {
    const url = this._eventUrl(ev);
    const text = encodeURIComponent(`🎟️ ${ev.name} — Get your tickets now!`);
    const encodedUrl = encodeURIComponent(url);
    return html`
      <div class="share-modal-overlay" @click=${this._closeShare}>
        <div class="share-modal" @click=${(e: Event) => e.stopPropagation()}>
          <h3>Share Event</h3>
          <p class="event-name-sm">${ev.name}</p>
          <div class="share-btns">
            <a class="share-btn" href="https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}" target="_blank" rel="noopener">
              𝕏 Share on X (Twitter)
            </a>
            <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Share on Facebook
            </a>
            <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              Share on LinkedIn
            </a>
            <button class="share-btn copy" @click=${() => this._copyLink(url)}>
              ${this.copiedLink ? '✅ Copied!' : '🔗 Copy event link'}
            </button>
          </div>
          <button class="share-modal-close" @click=${this._closeShare}>Close</button>
        </div>
      </div>
    `;
  }
}

