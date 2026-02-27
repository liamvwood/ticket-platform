import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

const DEMO_EVENTS = [
  { id: 'demo-1', name: 'Khruangbin at Stubb\'s', venue: { name: 'Stubb\'s Waller Creek Amphitheater' }, startsAt: '2025-08-15T20:00:00Z', ticketTypes: [{ price: 45 }, { price: 85 }], _demo: true, _icon: 'music' },
  { id: 'demo-2', name: 'Gary Clark Jr. Homecoming', venue: { name: 'Moody Center' }, startsAt: '2025-09-06T19:30:00Z', ticketTypes: [{ price: 60 }, { price: 120 }], _demo: true, _icon: 'music' },
  { id: 'demo-3', name: 'Austin City Limits Comedy Night', venue: { name: 'Paramount Theatre' }, startsAt: '2025-07-22T21:00:00Z', ticketTypes: [{ price: 35 }], _demo: true, _icon: 'mic' },
  { id: 'demo-4', name: 'ACL Fest Early Bird Drop', venue: { name: 'Zilker Park' }, startsAt: '2025-10-03T12:00:00Z', ticketTypes: [{ price: 175 }, { price: 350 }], _demo: true, _icon: 'star' },
  { id: 'demo-5', name: 'Black Pumas Secret Show', venue: { name: 'Parish Underground' }, startsAt: '2025-07-11T22:00:00Z', ticketTypes: [{ price: 25 }], _demo: true, _icon: 'music' },
  { id: 'demo-6', name: 'Willie Nelson Picnic', venue: { name: 'Outlaw Ranch' }, startsAt: '2025-07-04T16:00:00Z', ticketTypes: [{ price: 95 }, { price: 180 }], _demo: true, _icon: 'star' },
];

@customElement('page-events')
export class PageEvents extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
    .subtitle { color: #8888a8; margin-bottom: 2rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }
    .event-card {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 14px;
      overflow: hidden;
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }
    .event-card:hover {
      border-color: #6c63ff;
      transform: translateY(-3px);
      box-shadow: 0 12px 32px #0004;
    }
    .event-thumb {
      height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb-music { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); }
    .thumb-mic   { background: linear-gradient(135deg, #4a044e 0%, #831843 100%); }
    .thumb-star  { background: linear-gradient(135deg, #451a03 0%, #78350f 100%); }
    .event-body { padding: 1.25rem; }
    .event-name { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; line-height: 1.3; }
    .event-meta-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #8888a8; margin-bottom: 0.4rem; }
    .event-meta-row svg { flex-shrink: 0; }
    .event-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; }
    .event-price { font-size: 1rem; font-weight: 800; color: #4ade80; }
    .btn-tickets {
      background: #6c63ff22;
      color: #818cf8;
      border: 1px solid #3730a344;
      border-radius: 6px;
      padding: 0.3rem 0.8rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }
    .btn-tickets:hover { background: #6c63ff44; border-color: #6c63ff; }
    .empty { text-align: center; padding: 5rem; color: #8888a8; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .api-banner {
      background: #1e1e2e;
      border: 1px solid #2e2e3e;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #8888a8;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; }
  `;

  @state() events: any[] = [];
  @state() loading = true;
  @state() isDemo = false;

  async connectedCallback() {
    super.connectedCallback();
    try {
      const result = await api.getEvents();
      if (result.length > 0) {
        this.events = result;
      } else {
        this.events = DEMO_EVENTS;
        this.isDemo = true;
      }
    } catch {
      // API unavailable — show demo events so the page isn't empty
      this.events = DEMO_EVENTS;
      this.isDemo = true;
    } finally {
      this.loading = false;
    }
  }

  private _minPrice(event: any) {
    if (!event.ticketTypes?.length) return 'TBA';
    const min = Math.min(...event.ticketTypes.map((t: any) => t.price));
    return `From $${min.toFixed(0)}`;
  }

  private _thumbClass(ev: any) {
    if (ev._icon === 'mic') return 'thumb-mic';
    if (ev._icon === 'star') return 'thumb-star';
    return 'thumb-music';
  }

  private _thumbIcon(ev: any) {
    if (ev._icon === 'mic') return icons.mic;
    if (ev._icon === 'star') return icons.star;
    return icons.music;
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading events…</div>`;
    return html`
      <h1>Austin Events</h1>
      <p class="subtitle">Live music, comedy, festivals and more — straight from local venues.</p>
      ${this.isDemo ? html`
        <div class="api-banner">
          <div class="dot"></div>
          Showing example events — connect the API to see live listings.
        </div>
      ` : ''}
      <div class="grid">
        ${this.events.map(ev => html`
          <div class="event-card" @click=${() => navigate(`/events/${ev.id}`)}>
            <div class="event-thumb ${this._thumbClass(ev)}" .innerHTML=${this._thumbIcon(ev)}></div>
            <div class="event-body">
              <div class="event-name">${ev.name}</div>
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
    `;
  }
}
