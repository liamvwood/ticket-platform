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
    .search-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .search-input {
      flex: 1; background: #111820; border: 1px solid #1e2836; color: #F5F5F5;
      border-radius: 8px; padding: 0.55rem 1rem; font-size: 0.9rem; font-family: inherit;
      max-width: 320px;
    }
    .search-input:focus { outline: none; border-color: #00FF88; }
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
    .bulk-bar {
      display: flex; align-items: center; gap: 1rem;
      background: #1a2435; border: 1px solid #00FF8833;
      border-radius: 10px; padding: 0.65rem 1rem;
      margin-bottom: 0.75rem; font-size: 0.9rem;
    }
    .bulk-bar-count { color: #00FF88; font-weight: 700; flex: 1; }
    .btn-bulk { 
      background: #111820; border: 1px solid #1e2836; color: #ccc;
      padding: 0.4rem 0.9rem; border-radius: 6px; font-size: 0.85rem;
      cursor: pointer; font-family: inherit; font-weight: 600;
      transition: all 0.15s;
    }
    .btn-bulk:hover:not(:disabled) { border-color: #00FF88; color: #00FF88; }
    .btn-bulk.danger:hover:not(:disabled) { border-color: #f87171; color: #f87171; }
    .btn-bulk:disabled { opacity: 0.4; cursor: not-allowed; }
    input[type=checkbox] { accent-color: #00FF88; cursor: pointer; width: 15px; height: 15px; }
    .kebab-wrap { position: relative; display: inline-block; }
    .kebab-btn {
      background: transparent; border: 1px solid #1e2836;
      color: #888; border-radius: 6px;
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 1.1rem; line-height: 1;
      font-family: inherit; transition: border-color 0.15s, color 0.15s;
    }
    .kebab-btn:hover { border-color: #666; color: #fff; }
    .kebab-menu {
      position: absolute; right: 0; top: calc(100% + 4px);
      background: #1e1e2e; border: 1px solid #1e2836; border-radius: 8px;
      min-width: 140px; z-index: 50; overflow: hidden;
      box-shadow: 0 8px 24px #0008;
    }
    .kebab-item {
      display: block; width: 100%; text-align: left;
      background: none; border: none; color: #ccc;
      padding: 0.6rem 1rem; font-size: 0.87rem; font-family: inherit;
      cursor: pointer; transition: background 0.1s;
    }
    .kebab-item:hover { background: #1e2836; color: #fff; }
    @media (max-width: 640px) {
      :host { padding: 1rem; }
      h1 { font-size: 1.4rem; }
      .stats { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
      .stat-card { padding: 1rem; }
      .stat-val { font-size: 1.5rem; }
      .section-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
      .section-header > div { width: 100%; display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .section-header > div .btn, .section-header > div .btn-ghost { flex: 1; text-align: center; }
      .search-row { flex-direction: column; }
      .search-input { max-width: 100%; width: 100%; box-sizing: border-box; }
      .bulk-bar { flex-wrap: wrap; gap: 0.5rem; }
      .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 8px; }
      table { font-size: 0.82rem; min-width: 520px; }
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
  @state() selectedIds: Set<string> = new Set();
  @state() bulkBusy = false;
  @state() openKebab: string | null = null;
  @state() searchQuery = '';
  private _searchTimeout?: ReturnType<typeof setTimeout>;

  private _onSearch(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.searchQuery = val;
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => this._loadPage(1), 300);
  }

  private _closeKebab = () => { this.openKebab = null; };

  async connectedCallback() {
    super.connectedCallback();
    this.isOwner = getUserRole() === 'AppOwner';
    document.addEventListener('click', this._closeKebab);
    await this._loadPage(1);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._closeKebab);
  }

  private async _loadPage(page: number) {
    this.selectedIds = new Set();
    this.loading = true;
    try {
      const t0 = performance.now();
      const result = this.isOwner
        ? await api.getEventsAdmin(page, 20, this.searchQuery || undefined)
        : await api.getEvents({ page, pageSize: 20, search: this.searchQuery || undefined });
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

  private _toggleSelect(id: string) {
    const s = new Set(this.selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selectedIds = s;
  }

  private _selectAll(checked: boolean) {
    this.selectedIds = checked ? new Set(this.events.map(e => e.id)) : new Set();
  }

  private async _bulkPublish(publish: boolean) {
    if (this.selectedIds.size === 0) return;
    this.bulkBusy = true;
    try {
      await Promise.all([...this.selectedIds].map(id =>
        publish ? api.publishEvent(id) : api.unpublishEvent(id)
      ));
      this.selectedIds = new Set();
      await this._loadPage(this.page);
    } catch (err: any) {
      alert(err.message);
    } finally {
      this.bulkBusy = false;
    }
  }
  private async _copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    this.copiedLink = true;
    setTimeout(() => { this.copiedLink = false; this.requestUpdate(); }, 2000);
  }

  render() {
    if (this.loading) return html`
      <div style="max-width:1100px;margin:0 auto;padding:2rem">
        <style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>
        <div style="height:2.2rem;width:320px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:10px;animation:shimmer 1.5s infinite;margin-bottom:2rem"></div>
        <div style="height:2.2rem;width:240px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:8px;animation:shimmer 1.5s infinite;margin-bottom:0.6rem"></div>
        <div style="height:1rem;width:300px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite;margin-bottom:2.5rem"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:3rem">
          ${[1,2,3,4].map(() => html`
            <div style="background:#111820;border:1px solid #1e2836;border-radius:12px;padding:1.5rem">
              <div style="height:0.75rem;width:80px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:4px;animation:shimmer 1.5s infinite;margin-bottom:0.6rem"></div>
              <div style="height:2rem;width:80px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite"></div>
            </div>
          `)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div style="height:1.5rem;width:80px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite"></div>
          <div style="display:flex;gap:0.75rem">
            <div style="height:2rem;width:100px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:8px;animation:shimmer 1.5s infinite"></div>
            <div style="height:2rem;width:110px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:8px;animation:shimmer 1.5s infinite"></div>
          </div>
        </div>
        ${[1,2,3,4].map(() => html`
          <div style="display:flex;gap:1.25rem;align-items:center;padding:1rem;border-bottom:1px solid #1e1e2e">
            <div style="flex:2">
              <div style="height:1rem;width:55%;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite;margin-bottom:0.4rem"></div>
            </div>
            <div style="flex:1"><div style="height:0.85rem;width:70%;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite"></div></div>
            <div style="flex:1"><div style="height:1.4rem;width:60px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:999px;animation:shimmer 1.5s infinite"></div></div>
            <div style="flex:1">
              <div style="height:0.85rem;width:80%;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite;margin-bottom:6px"></div>
              <div style="height:6px;width:80%;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:999px;animation:shimmer 1.5s infinite"></div>
            </div>
            <div style="flex:1"><div style="height:0.85rem;width:60%;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.5s infinite"></div></div>
            <div style="display:flex;gap:0.5rem">
              <div style="width:36px;height:30px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:8px;animation:shimmer 1.5s infinite"></div>
              <div style="width:70px;height:30px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:8px;animation:shimmer 1.5s infinite"></div>
            </div>
          </div>
        `)}
      </div>`;
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

      <div class="search-row">
        <input class="search-input" type="search" placeholder="Search events…"
          .value=${this.searchQuery}
          @input=${this._onSearch} />
      </div>

      ${this.selectedIds.size > 0 ? html`
        <div class="bulk-bar">
          <span class="bulk-bar-count">${this.selectedIds.size} event${this.selectedIds.size === 1 ? '' : 's'} selected</span>
          <button class="btn-bulk" ?disabled=${this.bulkBusy} @click=${() => this._bulkPublish(true)}>
            ${this.bulkBusy ? 'Working…' : '✓ Publish'}
          </button>
          <button class="btn-bulk" ?disabled=${this.bulkBusy} @click=${() => this._bulkPublish(false)}>
            ${this.bulkBusy ? 'Working…' : 'Unpublish'}
          </button>
          <button class="btn-bulk" @click=${() => { this.selectedIds = new Set(); }}>Clear</button>
        </div>
      ` : ''}

      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" 
              .checked=${this.selectedIds.size === this.events.length && this.events.length > 0}
              @change=${(e: any) => this._selectAll(e.target.checked)} /></th>
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
            ? html`<tr class="empty-row"><td colspan="${this.isOwner ? 8 : 7}">No events yet — create one to get started.</td></tr>`
            : this.events.map(ev => {
                const tTypes = ev.ticketTypes ?? [];
                const evSold = tTypes.reduce((s: number, tt: any) => s + tt.quantitySold, 0);
                const evTotal = tTypes.reduce((s: number, tt: any) => s + tt.totalQuantity, 0);
                const evRev = tTypes.reduce((s: number, tt: any) => s + tt.quantitySold * tt.price, 0);
                const pct = evTotal ? Math.round(evSold / evTotal * 100) : 0;
                return html`
                  <tr>
                    <td><input type="checkbox" 
                      .checked=${this.selectedIds.has(ev.id)}
                      @change=${() => this._toggleSelect(ev.id)} /></td>
                    <td>
                      <strong>${ev.name}</strong>
                      ${ev.recurringRule ? html`<span class="recurring-badge">↻ ${ev.recurringRule.charAt(0) + ev.recurringRule.slice(1).toLowerCase()}</span>` : ''}
                      ${ev.isCancelled ? html`<span class="badge" style="background:#7f1d1d;color:#fca5a5;margin-left:.4rem">Cancelled</span>` : ''}
                    </td>
                    ${this.isOwner ? html`<td>${ev.venue?.name ?? '—'}</td>` : ''}
                    <td>${new Date(ev.startsAt).toLocaleDateString()}</td>
                    <td>
                      ${ev.isCancelled
                        ? html`<span class="badge" style="background:#7f1d1d;color:#fca5a5">Cancelled</span>`
                        : html`<span class="badge ${ev.isPublished ? 'badge-pub' : 'badge-draft'}">${ev.isPublished ? 'Published' : 'Draft'}</span>`}
                    </td>
                    <td>
                      ${evSold} / ${evTotal}
                      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                    </td>
                    <td>
                      $${evRev.toFixed(2)}
                      ${!ev.isCancelled && new Date(ev.endsAt) < new Date() ? html`
                        <div style="font-size:0.75rem;margin-top:2px;color:${ev.fundsReleasedAt ? '#00FF88' : '#f59e0b'}">
                          ${ev.fundsReleasedAt ? '✅ Funds released' : '⏳ Pending payout'}
                        </div>
                      ` : ''}
                    </td>
                    <td>
                      <div class="kebab-wrap" @click=${(e: Event) => e.stopPropagation()}>
                        <button class="kebab-btn" @click=${() => this.openKebab = this.openKebab === ev.id ? null : ev.id}>⋮</button>
                        ${this.openKebab === ev.id ? html`
                          <div class="kebab-menu">
                            <button class="kebab-item" @click=${() => { this._openShare(ev); this.openKebab = null; }}>📤 Share</button>
                            ${!ev.isCancelled ? html`
                              <button class="kebab-item" @click=${() => { navigate('/venue/events/' + ev.id); this.openKebab = null; }}>⚙ Manage</button>
                            ` : ''}
                          </div>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              })
          }
        </tbody>
      </table>
      </div>
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

