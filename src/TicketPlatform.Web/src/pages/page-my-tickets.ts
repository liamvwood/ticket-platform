import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';
import QRCode from 'qrcode';

type Filter = 'upcoming' | 'past' | 'all';

// Deterministic accent palette per ticket (cycles on event id hash)
const PALETTES = [
  { from: '#6c63ff', to: '#a78bfa', text: '#e9e6ff' },
  { from: '#0ea5e9', to: '#38bdf8', text: '#e0f2fe' },
  { from: '#10b981', to: '#34d399', text: '#d1fae5' },
  { from: '#f59e0b', to: '#fbbf24', text: '#fef3c7' },
  { from: '#ef4444', to: '#f87171', text: '#fee2e2' },
  { from: '#ec4899', to: '#f472b6', text: '#fce7f3' },
];
function palette(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

@customElement('page-my-tickets')
export class PageMyTickets extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 680px; margin: 0 auto; }

    /* ── Header ── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;
    }
    h1 { font-size: 2rem; font-weight: 900; margin: 0; }
    .count-badge {
      background: #2e2e3e; color: #a5b4fc;
      font-size: 0.8rem; font-weight: 700;
      padding: 0.2rem 0.6rem; border-radius: 999px;
      vertical-align: middle; margin-left: 0.5rem;
    }

    /* ── Filter tabs ── */
    .filter-tabs {
      display: flex; gap: 0.5rem; margin-bottom: 1.75rem;
    }
    .tab {
      padding: 0.45rem 1.1rem; border-radius: 999px;
      border: 1px solid #2e2e3e; font-size: 0.85rem; font-weight: 600;
      cursor: pointer; font-family: inherit; background: transparent; color: #8888a8;
      transition: all 0.15s;
    }
    .tab:hover { border-color: #6c63ff; color: #a89cff; }
    .tab.active { background: #6c63ff; border-color: #6c63ff; color: #fff; }

    /* ── Ticket shell ── */
    .ticket-shell {
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      margin-bottom: 2rem;
      position: relative;
    }

    /* ── Ticket header (colored top) ── */
    .ticket-top {
      padding: 1.75rem 1.75rem 1.5rem;
      position: relative; overflow: hidden;
    }
    .ticket-top::after {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.18);
      pointer-events: none;
    }
    .ticket-top-content { position: relative; z-index: 1; }
    .tt-badges { display: flex; gap: 0.5rem; margin-bottom: 0.9rem; align-items: center; }
    .live-badge {
      font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
      padding: 0.2rem 0.55rem; border-radius: 4px;
      background: rgba(255,255,255,0.2); color: #fff;
    }
    .event-name-big {
      font-size: 1.5rem; font-weight: 900; line-height: 1.2;
      color: #fff; margin-bottom: 0.6rem;
      text-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .event-meta-row {
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .event-meta-row span {
      font-size: 0.85rem; color: rgba(255,255,255,0.82);
      display: flex; align-items: center; gap: 0.4rem;
    }
    .tt-name-label {
      display: inline-block; margin-top: 0.75rem;
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 0.25rem 0.65rem; border-radius: 6px;
      background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9);
    }
    /* Checked-in overlay stripe */
    .checked-stripe {
      position: absolute; top: 0; right: 0;
      background: #22c55e; color: #fff; font-weight: 800; font-size: 0.7rem;
      padding: 0.3rem 0.85rem 0.3rem 1.2rem;
      clip-path: polygon(10% 0%, 100% 0%, 100% 100%, 0% 100%);
      letter-spacing: 0.05em; text-transform: uppercase;
      z-index: 2;
    }

    /* ── Perforation divider ── */
    .perforation {
      display: flex; align-items: center;
      background: #12121c; position: relative; height: 20px;
    }
    .perf-notch {
      width: 20px; height: 20px; border-radius: 50%;
      flex-shrink: 0;
    }
    .perf-notch-left { background: #0a0a0f; margin-left: -10px; }
    .perf-notch-right { background: #0a0a0f; margin-right: -10px; margin-left: auto; }
    .perf-line {
      flex: 1; border-top: 2px dashed #2e2e3e; margin: 0 0.5rem;
    }

    /* ── Ticket stub (bottom white/dark section) ── */
    .ticket-stub {
      background: #1a1a24; padding: 1.5rem 1.75rem;
      display: flex; gap: 1.5rem; align-items: center;
    }
    .qr-wrap {
      flex-shrink: 0;
      background: #fff; border-radius: 10px;
      padding: 0.5rem;
    }
    .qr-wrap img { display: block; width: 100px; height: 100px; image-rendering: pixelated; }
    .qr-pending {
      width: 100px; height: 100px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #0d0d14; border-radius: 10px; border: 1px dashed #2e2e3e;
      font-size: 2rem; gap: 0.3rem;
    }
    .qr-pending span { font-size: 0.65rem; color: #555568; }
    .stub-info { flex: 1; min-width: 0; }
    .stub-label {
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #555568; margin-bottom: 0.25rem;
    }
    .stub-value { font-size: 0.9rem; font-weight: 700; color: #c8c8e0; margin-bottom: 0.9rem; }
    .stub-status { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.22rem 0.65rem; border-radius: 999px;
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-paid { background: #14532d; color: #22c55e; }
    .badge-pending { background: #451a03; color: #f59e0b; }
    .badge-cancelled { background: #450a0a; color: #ef4444; }
    .badge-checked { background: #1e1b4b; color: #818cf8; }

    /* ── Action row ── */
    .ticket-actions {
      padding: 0.75rem 1.75rem 1rem;
      background: #14141e; border-top: 1px solid #1e1e2e;
      display: flex; gap: 0.5rem; flex-wrap: wrap;
    }
    .action-btn {
      flex: 1; min-width: 80px;
      display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
      padding: 0.55rem 0.5rem; border-radius: 10px;
      border: 1px solid #2e2e3e; background: transparent;
      color: #8888a8; font-size: 0.72rem; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: all 0.15s;
    }
    .action-btn:hover { border-color: #6c63ff; color: #a89cff; background: #1a1a2e; }
    .action-icon { font-size: 1.2rem; line-height: 1; }

    /* ── Fullscreen QR modal ── */
    .qr-modal {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,0.9);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 1.5rem;
    }
    .qr-modal-close {
      position: absolute; top: 1.25rem; right: 1.25rem;
      background: #2e2e3e; border: none; color: #fff;
      width: 36px; height: 36px; border-radius: 50%;
      font-size: 1rem; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center;
    }
    .qr-modal-event { font-size: 1.2rem; font-weight: 900; margin-bottom: 0.25rem; text-align: center; }
    .qr-modal-sub { font-size: 0.85rem; color: #8888a8; margin-bottom: 1.5rem; text-align: center; }
    .qr-modal-img { background: #fff; border-radius: 16px; padding: 1rem; margin-bottom: 1rem; }
    .qr-modal-img img { display: block; width: 220px; height: 220px; image-rendering: pixelated; }
    .qr-modal-hint { font-size: 0.8rem; color: #555568; text-align: center; max-width: 280px; line-height: 1.6; }
    .wallet-btns { display: flex; gap: 0.75rem; margin-top: 1.25rem; flex-wrap: wrap; justify-content: center; }
    .wallet-btn {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.65rem 1.25rem; border-radius: 10px;
      font-weight: 700; font-size: 0.85rem; font-family: inherit;
      cursor: pointer; border: none; transition: opacity 0.15s;
    }
    .wallet-btn:hover { opacity: 0.88; }
    .wallet-btn-apple { background: #1c1c1e; color: #fff; border: 1px solid #3a3a3c; }
    .wallet-btn-google { background: #1a73e8; color: #fff; }

    /* ── Empty / loading ── */
    .empty { text-align: center; padding: 5rem 2rem; color: #8888a8; }
    .empty-icon { font-size: 4rem; margin-bottom: 1rem; }
    .empty p { margin-bottom: 1.5rem; font-size: 1rem; }
    .btn-browse {
      background: #6c63ff; color: #fff;
      padding: 0.75rem 2rem; border-radius: 10px;
      font-weight: 700; cursor: pointer; border: none;
      font-family: inherit; font-size: 0.95rem;
    }
    .btn-browse:hover { background: #5a52e0; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }

    /* ── Toast ── */
    .toast {
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      background: #1e3a1e; border: 1px solid #22c55e;
      color: #22c55e; padding: 0.7rem 1.5rem;
      border-radius: 10px; font-weight: 600; z-index: 999;
      white-space: nowrap; font-size: 0.9rem;
      animation: slide-up 0.2s ease;
    }
    @keyframes slide-up {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    @media (max-width: 520px) {
      :host { padding: 1rem; }
      h1 { font-size: 1.6rem; }
      .event-name-big { font-size: 1.2rem; }
      .ticket-stub { flex-direction: column; align-items: flex-start; }
      .ticket-actions { gap: 0.35rem; }
      .action-btn { font-size: 0.67rem; padding: 0.5rem 0.35rem; }
    }
  `;

  @state() orders: any[] = [];
  @state() loading = true;
  @state() filter: Filter = 'upcoming';
  @state() expandedTicketId: string | null = null;
  @state() toast: string | null = null;
  @state() qrDataUrls: Record<string, string> = {};

  async connectedCallback() {
    super.connectedCallback();
    if (!auth.isLoggedIn) { navigate('/login'); return; }
    try {
      this.orders = await api.getOrders();
      // Generate real QR codes for all paid tickets
      const urls: Record<string, string> = {};
      for (const order of this.orders) {
        for (const ticket of order.tickets ?? []) {
          if (ticket.qrToken) {
            urls[ticket.id] = await QRCode.toDataURL(ticket.qrToken, {
              width: 220, margin: 1,
              color: { light: '#ffffff', dark: '#12121c' },
            });
          }
        }
      }
      this.qrDataUrls = urls;
    } finally {
      this.loading = false;
    }
  }

  private _showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => { this.toast = null; this.requestUpdate(); }, 2500);
  }

  private async _share(ticket: any) {
    const ev = ticket.ticketType?.event;
    if (!ev) return;
    const url = `${location.origin}/events/${ev.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: ev.name, text: `I'm going to ${ev.name}! Get your tickets.`, url });
      } else {
        await navigator.clipboard.writeText(url);
        this._showToast('Event link copied to clipboard!');
      }
    } catch { /* user cancelled */ }
  }

  private _addToCalendar(ticket: any) {
    const ev = ticket.ticketType?.event;
    if (!ev) return;
    const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const venue = ev.venue;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TicketPlatform//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:ticket-${ticket.id}@ticketplatform`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(ev.startsAt)}`,
      `DTEND:${fmt(ev.endsAt || ev.startsAt)}`,
      `SUMMARY:🎫 ${ev.name}`,
      `DESCRIPTION:${ticket.ticketType?.name} ticket\\nOrder #${ticket.order?.id?.substring(0, 8) ?? ''}`,
      venue ? `LOCATION:${venue.name}, ${venue.address ? venue.address + ', ' : ''}${venue.city}, ${venue.state}` : '',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${ev.name} starts in 1 hour!`, 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${ev.name} is tomorrow!`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ev.name.replace(/[^a-z0-9]/gi, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    this._showToast('Calendar event downloaded!');
  }

  private _openWallet(ticketId: string) {
    this.expandedTicketId = this.expandedTicketId === ticketId ? null : ticketId;
  }

  private _statusBadge(status: string) {
    const map: Record<string, string> = {
      Paid: 'badge-paid', Pending: 'badge-pending', AwaitingPayment: 'badge-pending',
      Cancelled: 'badge-cancelled', Refunded: 'badge-cancelled',
    };
    return map[status] ?? 'badge-pending';
  }

  private _filterTickets(tickets: any[]): any[] {
    const now = Date.now();
    if (this.filter === 'all') return tickets;
    return tickets.filter((t: any) => {
      const start = t.ticketType?.event?.startsAt;
      if (!start) return this.filter === 'upcoming';
      const isPast = new Date(start).getTime() < now;
      return this.filter === 'past' ? isPast : !isPast;
    });
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading tickets…</div>`;

    const allTickets = this.orders.flatMap((o: any) =>
      (o.tickets ?? []).map((t: any) => ({ ...t, order: o }))
    );
    const filtered = this._filterTickets(allTickets);

    const totalCount = allTickets.length;

    // Fullscreen QR modal
    const expandedTicket = allTickets.find(t => t.id === this.expandedTicketId);

    return html`
      ${expandedTicket ? this._renderQrModal(expandedTicket) : nothing}
      ${this.toast ? html`<div class="toast">✓ ${this.toast}</div>` : nothing}

      <div class="page-header">
        <h1>My Tickets <span class="count-badge">${totalCount}</span></h1>
      </div>

      <div class="filter-tabs">
        ${(['upcoming', 'past', 'all'] as Filter[]).map(f => html`
          <button class="tab ${this.filter === f ? 'active' : ''}"
            @click=${() => { this.filter = f; }}>
            ${f === 'upcoming' ? 'Upcoming' : f === 'past' ? 'Past' : 'All'}
          </button>
        `)}
      </div>

      ${filtered.length === 0 ? html`
        <div class="empty">
          <div class="empty-icon">🎟️</div>
          <p>${this.filter === 'past' ? 'No past tickets.' : 'No upcoming tickets.'}</p>
          <button class="btn-browse" @click=${() => navigate('/events')}>Browse Events</button>
        </div>
      ` : filtered.map(t => this._renderTicket(t))}
    `;
  }

  private _renderTicket(t: any) {
    const ev = t.ticketType?.event;
    const pal = palette(ev?.id ?? t.id);
    const isCheckedIn = t.status === 'CheckedIn';
    const isPaid = t.order?.status === 'Paid';
    const dateStr = ev?.startsAt
      ? new Date(ev.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';
    const venue = ev?.venue;

    return html`
      <div class="ticket-shell" style="border: 1px solid ${pal.from}33">
        <!-- Colored header -->
        <div class="ticket-top" style="background: linear-gradient(135deg, ${pal.from} 0%, ${pal.to} 100%)">
          ${isCheckedIn ? html`<div class="checked-stripe">✓ Checked In</div>` : nothing}
          <div class="ticket-top-content">
            <div class="tt-badges">
              <span class="live-badge">🎫 Ticket</span>
            </div>
            <div class="event-name-big">${ev?.name ?? 'Event'}</div>
            <div class="event-meta-row">
              ${dateStr ? html`<span>📅 ${dateStr}</span>` : nothing}
              ${venue ? html`<span>📍 ${venue.name}${venue.city ? ', ' + venue.city : ''}</span>` : nothing}
            </div>
            <span class="tt-name-label">${t.ticketType?.name ?? 'Ticket'}</span>
          </div>
        </div>

        <!-- Perforation -->
        <div class="perforation">
          <div class="perf-notch perf-notch-left"></div>
          <div class="perf-line"></div>
          <div class="perf-notch perf-notch-right"></div>
        </div>

        <!-- Stub with QR -->
        <div class="ticket-stub">
          ${isPaid && this.qrDataUrls[t.id] ? html`
            <div class="qr-wrap">
              <img src="${this.qrDataUrls[t.id]}" alt="Ticket QR code" />
            </div>
          ` : html`
            <div class="qr-pending">🔒<span>Pending</span></div>
          `}
          <div class="stub-info">
            <div class="stub-label">Order</div>
            <div class="stub-value">#${(t.order?.id ?? '').substring(0, 8).toUpperCase()}</div>
            <div class="stub-status">
              <span class="badge ${this._statusBadge(t.order?.status ?? '')}">
                ${t.order?.status === 'Paid' ? '✓' : '○'} ${t.order?.status}
              </span>
              ${isCheckedIn ? html`<span class="badge badge-checked">✓ Checked In</span>` : nothing}
            </div>
          </div>
        </div>

        <!-- Action bar -->
        <div class="ticket-actions">
          <button class="action-btn" @click=${() => this._share(t)}>
            <span class="action-icon">🔗</span>Share
          </button>
          <button class="action-btn" @click=${() => this._addToCalendar(t)}>
            <span class="action-icon">📅</span>Remind me
          </button>
          <button class="action-btn" @click=${() => this._openWallet(t.id)}>
            <span class="action-icon">💳</span>Wallet
          </button>
          <button class="action-btn" @click=${() => this._openWallet(t.id)}>
            <span class="action-icon">🔍</span>Full QR
          </button>
        </div>
      </div>
    `;
  }

  private _renderQrModal(t: any) {
    const ev = t.ticketType?.event;
    const pal = palette(ev?.id ?? t.id);
    const qr = this.qrDataUrls[t.id];
    const dateStr = ev?.startsAt
      ? new Date(ev.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';

    return html`
      <div class="qr-modal" @click=${(e: Event) => { if (e.target === e.currentTarget) this.expandedTicketId = null; }}>
        <button class="qr-modal-close" @click=${() => { this.expandedTicketId = null; }}>✕</button>

        <div class="qr-modal-event" style="color:${pal.from}">${ev?.name ?? 'Event'}</div>
        <div class="qr-modal-sub">
          ${t.ticketType?.name}${dateStr ? '  ·  ' + dateStr : ''}
        </div>

        ${qr ? html`
          <div class="qr-modal-img">
            <img src="${qr}" alt="Ticket QR code" />
          </div>
          <div class="qr-modal-hint">Present this QR code at the door for entry.<br/>Tap and hold to save the image.</div>
          <div class="wallet-btns">
            <button class="wallet-btn wallet-btn-apple" @click=${() => this._addToCalendar(t)}>
              🍎 Add to Apple Calendar
            </button>
            <button class="wallet-btn wallet-btn-google" @click=${() => this._addToCalendar(t)}>
              📆 Add to Google Calendar
            </button>
          </div>
        ` : html`
          <div class="qr-pending" style="width:180px;height:180px">🔒<span>QR available after payment</span></div>
        `}
      </div>
    `;
  }
}

