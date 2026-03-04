import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

const DEMO_EVENTS: any[] = [
  { id: 'demo-1', name: 'Khruangbin at Stubb\'s', venue: { name: 'Stubb\'s Waller Creek Amphitheater' }, startsAt: '2025-08-15T20:00:00Z', ticketTypes: [{ price: 45 }, { price: 85 }], eventType: 'music', _demo: true },
  { id: 'demo-2', name: 'Gary Clark Jr. Homecoming', venue: { name: 'Moody Center' }, startsAt: '2025-09-06T19:30:00Z', ticketTypes: [{ price: 60 }, { price: 120 }], eventType: 'music', _demo: true },
  { id: 'demo-3', name: 'Austin City Limits Comedy Night', venue: { name: 'Paramount Theatre' }, startsAt: '2025-07-22T21:00:00Z', ticketTypes: [{ price: 35 }], eventType: 'comedy', _demo: true },
  { id: 'demo-4', name: 'ACL Fest Early Bird Drop', venue: { name: 'Zilker Park' }, startsAt: '2025-10-03T12:00:00Z', ticketTypes: [{ price: 175 }, { price: 350 }], eventType: 'music', isHot: true, _demo: true },
  { id: 'demo-5', name: 'Black Pumas Secret Show', venue: { name: 'Parish Underground' }, startsAt: '2025-07-11T22:00:00Z', ticketTypes: [{ price: 25 }], eventType: 'music', ticketsDroppingSoon: true, _demo: true },
  { id: 'demo-6', name: 'Willie Nelson Picnic', venue: { name: 'Outlaw Ranch' }, startsAt: '2025-07-04T16:00:00Z', ticketTypes: [{ price: 95 }, { price: 180 }], eventType: 'other', _demo: true },
];

@customElement('page-events')
export class PageEvents extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
    .subtitle { color: #6b7a8d; margin-bottom: 1.5rem; }

    /* Tabs */
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
    .tab {
      background: #111820; border: 1px solid #1e2836; color: #6b7a8d;
      padding: 0.45rem 1.25rem; border-radius: 9999px; font-size: 0.9rem;
      font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s;
    }
    .tab:hover { border-color: #00FF8866; color: #ccc; }
    .tab.active { background: #0d1a15; border-color: #00FF88; color: #00FF88; }

    /* Filter bar */
    .filter-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.75rem; }
    .filter-select {
      background: #111820; border: 1px solid #1e2836; color: #ccc;
      padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem;
      font-family: inherit; cursor: pointer; transition: all 0.2s;
      appearance: none; -webkit-appearance: none;
      padding-right: 1.6rem;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7a8d'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 0.6rem center;
    }
    .filter-select:hover, .filter-select:focus { border-color: #00FF8866; outline: none; }
    .filter-select.filter-active { border-color: #00FF88; color: #00FF88; background-color: #0d1a15; }
    .filter-select option { background: #111820; color: #f0f0f0; }
    .filter-btn {
      background: #111820; border: 1px solid #1e2836; color: #ccc;
      padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem;
      font-family: inherit; cursor: pointer; transition: all 0.2s;
    }
    .filter-btn:hover { border-color: #00FF8866; color: #ccc; }
    .filter-btn.filter-active { background: #0d1a15; border-color: #00FF88; color: #00FF88; }
    .filter-clear {
      background: transparent; border: none; color: #6b7a8d; font-size: 0.82rem;
      font-family: inherit; cursor: pointer; padding: 0.4rem 0.5rem;
      transition: color 0.2s; text-decoration: underline;
    }
    .filter-clear:hover { color: #ccc; }

    /* Grid */
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      justify-content: center;
    }
    .event-card {
      background: #111820;
      border: 1px solid #1e2836;
      border-radius: 14px;
      overflow: hidden;
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
      width: 320px;
      flex-shrink: 0;
    }
    .event-card:hover {
      border-color: #00FF88;
      transform: translateY(-3px);
      box-shadow: 0 12px 32px #0004;
    }
    .event-thumb {
      height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }
    .event-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-music  { background: linear-gradient(135deg, #0d1a15 0%, #312e81 100%); }
    .thumb-comedy { background: linear-gradient(135deg, #4a044e 0%, #831843 100%); }
    .thumb-sports { background: linear-gradient(135deg, #0c2340 0%, #1e4d8c 100%); }
    .thumb-arts   { background: linear-gradient(135deg, #3d0012 0%, #7c1048 100%); }
    .thumb-food   { background: linear-gradient(135deg, #1a0800 0%, #6b2500 100%); }
    .thumb-tech   { background: linear-gradient(135deg, #001a2e 0%, #00466b 100%); }
    .thumb-other  { background: linear-gradient(135deg, #0d1a15 0%, #312e81 100%); }

    /* Badges */
    .badge-hot {
      position: absolute; top: 8px; left: 8px;
      background: #FF5A1F; color: white; font-size: 12px;
      padding: 2px 8px; border-radius: 9999px; font-weight: 700; line-height: 1.5;
    }
    .badge-dropping {
      position: absolute; top: 8px; right: 8px;
      background: #FFD700; color: #0B0F14; font-size: 11px;
      padding: 2px 8px; border-radius: 9999px; font-weight: 700; line-height: 1.5;
      white-space: nowrap;
    }

    .event-body { padding: 1.25rem; }
    .event-name { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; line-height: 1.3; }

    /* Type chip */
    .type-chip {
      display: inline-block; background: #0d1a15; border: 1px solid #1e3a2e;
      color: #00CC6A; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; border-radius: 9999px; padding: 0.1rem 0.55rem;
      margin-bottom: 0.4rem;
    }

    .recurring-badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      background: #0d1a15; border: 1px solid #00FF8833; color: #00FF88;
      border-radius: 999px; padding: 0.1rem 0.55rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; margin-bottom: 0.4rem;
    }
    .event-meta-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #6b7a8d; margin-bottom: 0.4rem; }
    .event-meta-row svg { flex-shrink: 0; }
    .event-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; }
    .event-price { font-size: 1rem; font-weight: 800; color: #00FF88; }
    .btn-tickets {
      background: #00FF8811; color: #00FF88; border: 1px solid #00FF8833;
      border-radius: 6px; padding: 0.3rem 0.8rem; font-size: 0.8rem;
      font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s;
    }
    .btn-tickets:hover { background: #00FF8822; border-color: #00FF88; }

    /* States */
    .empty { text-align: center; padding: 5rem 2rem; color: #6b7a8d; }
    .loading { text-align: center; padding: 5rem; color: #6b7a8d; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .spinner {
      width: 36px; height: 36px; border: 3px solid #1e2836;
      border-top-color: #00FF88; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .api-banner {
      background: #1e1e2e; border: 1px solid #1e2836; border-radius: 8px;
      padding: 0.75rem 1rem; color: #6b7a8d; font-size: 0.85rem;
      margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 2.5rem; }
    .page-btn {
      background: #111820; border: 1px solid #1e2836; color: #ccc;
      padding: 0.45rem 0.9rem; border-radius: 8px; font-size: 0.85rem;
      cursor: pointer; font-family: inherit; transition: all 0.2s;
      min-width: 2.5rem; text-align: center;
    }
    .page-btn:hover:not(:disabled) { border-color: #00FF88; color: #00FF88; }
    .page-btn.active { background: #00FF88; border-color: #00FF88; color: #0B0F14; font-weight: 700; }
    .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .page-info { color: #6b7a8d; font-size: 0.85rem; padding: 0 0.5rem; }

    @media (max-width: 640px) {
      :host { padding: 1.25rem; }
      h1 { font-size: 1.5rem; }
      .event-card { width: 100%; }
    }
  `;

  @state() private _tab: 'upcoming' | 'past' = 'upcoming';
  @state() private _typeFilter = '';
  @state() private _dateFilter = '';
  @state() private _hotFilter = false;
  @state() private _eventTypes: string[] = [];
  @state() private _events: any[] = [];
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _pageSize = 12;
  @state() private _loading = true;
  @state() private _isDemo = false;

  async connectedCallback() {
    super.connectedCallback();
    try { this._eventTypes = await api.getEventTypes(); } catch {}
    await this._load();
  }

  private async _load() {
    this._loading = true;
    try {
      const result = await api.getEvents({
        tab: this._tab,
        type: this._typeFilter || undefined,
        date: (this._dateFilter as 'today' | 'upcoming') || undefined,
        hot: this._hotFilter || undefined,
        page: this._page,
        pageSize: this._pageSize,
      });
      if (result.items?.length > 0) {
        this._events = result.items;
        this._total = result.total;
        this._page = result.page;
        this._isDemo = false;
      } else {
        this._events = [];
        this._total = 0;
        this._isDemo = false;
      }
    } catch {
      this._events = DEMO_EVENTS;
      this._isDemo = true;
      this._total = DEMO_EVENTS.length;
    } finally {
      this._loading = false;
    }
  }

  private async _setTab(tab: 'upcoming' | 'past') {
    this._tab = tab; this._page = 1; await this._load();
  }

  private async _setType(type: string) {
    this._typeFilter = type; this._page = 1; await this._load();
  }

  private async _setDate(date: string) {
    this._dateFilter = date; this._page = 1; await this._load();
  }

  private async _toggleHot() {
    this._hotFilter = !this._hotFilter; this._page = 1; await this._load();
  }

  private async _clearFilters() {
    this._typeFilter = ''; this._dateFilter = ''; this._hotFilter = false;
    this._page = 1; await this._load();
  }

  private async _goToPage(p: number) {
    const totalPages = Math.ceil(this._total / this._pageSize);
    if (p < 1 || p > totalPages) return;
    this._page = p;
    await this._load();
    this.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _minPrice(event: any) {
    if (!event.ticketTypes?.length) return 'TBA';
    const min = Math.min(...event.ticketTypes.map((t: any) => t.price));
    return `From $${min.toFixed(0)}`;
  }

  private _thumbClass(ev: any) {
    switch (ev.eventType) {
      case 'comedy': return 'thumb-comedy';
      case 'sports': return 'thumb-sports';
      case 'arts':   return 'thumb-arts';
      case 'food':   return 'thumb-food';
      case 'tech':   return 'thumb-tech';
      case 'other':  return 'thumb-other';
      default:       return 'thumb-music';
    }
  }

  private _thumbIcon(ev: any) {
    if (ev.eventType === 'comedy') return icons.mic;
    return icons.music;
  }

  private _cap(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  private _renderPagination() {
    const totalPages = Math.ceil(this._total / this._pageSize);
    if (totalPages <= 1) return '';
    const pages: (number | string)[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - this._page) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }
    return html`
      <div class="pagination">
        <button class="page-btn" ?disabled=${this._page <= 1} @click=${() => this._goToPage(this._page - 1)}>‹ Prev</button>
        ${pages.map(p => p === '…'
          ? html`<span class="page-info">…</span>`
          : html`<button class="page-btn ${p === this._page ? 'active' : ''}" @click=${() => this._goToPage(p as number)}>${p}</button>`
        )}
        <button class="page-btn" ?disabled=${this._page >= totalPages} @click=${() => this._goToPage(this._page + 1)}>Next ›</button>
      </div>
    `;
  }

  render() {
    const typeOptions = this._eventTypes.length > 0 ? this._eventTypes : ['comedy','music','sports','arts','food','tech','other'];
    const hasFilters = !!(this._typeFilter || this._dateFilter || this._hotFilter);

    return html`
      <h1>Austin Events</h1>
      <p class="subtitle">Live music, comedy, festivals and more — straight from local venues.</p>

      ${this._isDemo ? html`
        <div class="api-banner">
          <div class="dot"></div>
          Showing example events — connect the API to see live listings.
        </div>
      ` : ''}

      <div class="tabs">
        <button class="tab ${this._tab === 'upcoming' ? 'active' : ''}" @click=${() => this._setTab('upcoming')}>Upcoming</button>
        <button class="tab ${this._tab === 'past' ? 'active' : ''}" @click=${() => this._setTab('past')}>Past</button>
      </div>

      <div class="filter-bar">
        <select class="filter-select ${this._typeFilter ? 'filter-active' : ''}"
          .value=${this._typeFilter} @change=${(e: any) => this._setType(e.target.value)}>
          <option value="">Type ▾</option>
          ${typeOptions.map(t => html`<option value=${t}>${this._cap(t)}</option>`)}
        </select>
        <select class="filter-select ${this._dateFilter ? 'filter-active' : ''}"
          .value=${this._dateFilter} @change=${(e: any) => this._setDate(e.target.value)}>
          <option value="">Date ▾</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <button class="filter-btn ${this._hotFilter ? 'filter-active' : ''}" @click=${this._toggleHot}>🔥 Hot</button>
        ${hasFilters ? html`<button class="filter-clear" @click=${this._clearFilters}>Clear filters</button>` : ''}
      </div>

      ${this._loading ? html`
        <div class="loading"><div class="spinner"></div>Loading events…</div>
      ` : this._events.length === 0 ? html`
        <div class="empty">
          <div style="font-size:2.5rem;margin-bottom:1rem">🎟</div>
          <div style="font-weight:700;font-size:1.1rem;margin-bottom:.5rem">No events found</div>
          <div>Try adjusting your filters.</div>
        </div>
      ` : html`
        <div class="grid">
          ${this._events.map(ev => html`
            <div class="event-card" @click=${() => navigate(`/events/${ev.slug || ev.id}`)}>
              <div class="event-thumb ${ev.thumbnailUrl ? '' : this._thumbClass(ev)}">
                ${ev.thumbnailUrl
                  ? html`<img src=${ev.thumbnailUrl} alt=${ev.name} loading="lazy" />`
                  : html`<span .innerHTML=${this._thumbIcon(ev)}></span>`}
                ${ev.isHot ? html`<span class="badge-hot">🔥</span>` : ''}
                ${ev.ticketsDroppingSoon ? html`<span class="badge-dropping">🎟 Dropping Soon</span>` : ''}
              </div>
              <div class="event-body">
                <div class="event-name">${ev.name}</div>
                ${ev.eventType ? html`<span class="type-chip">${this._cap(ev.eventType)}</span>` : ''}
                ${ev.recurringRule ? html`<div class="recurring-badge">↻ ${ev.recurringRule.charAt(0) + ev.recurringRule.slice(1).toLowerCase()}</div>` : ''}
                <div class="event-meta-row">
                  <span .innerHTML=${icons.mapPin}></span>
                  ${ev.venue?.name ?? 'Austin, TX'}
                </div>
                <div class="event-meta-row">
                  <span .innerHTML=${icons.cal}></span>
                  ${new Date(ev.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div class="event-footer">
                  <div class="event-price">${this._minPrice(ev)}</div>
                  <button class="btn-tickets">Get Tickets</button>
                </div>
              </div>
            </div>
          `)}
        </div>
        ${this._renderPagination()}
      `}
    `;
  }
}
