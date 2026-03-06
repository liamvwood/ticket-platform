import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

type OtpStep = 'phone' | 'code' | 'done';

@customElement('page-event-detail')
export class PageEventDetail extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 900px; margin: 0 auto; }
    .back { color: #6b7a8d; cursor: pointer; font-size: 0.9rem; margin-bottom: 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .back:hover { color: #fff; }
    .header { margin-bottom: 2rem; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .header h1 { font-size: 2.2rem; font-weight: 900; margin-bottom: 0.5rem; }
    .meta { display: flex; gap: 1.5rem; flex-wrap: wrap; color: #6b7a8d; font-size: 0.9rem; margin-bottom: 1rem; }
    .meta span { display: flex; align-items: center; gap: 0.4rem; }
    .desc {
      line-height: 1.85;
      margin-bottom: 2rem;
      font-size: 1.05rem;
      color: #c8cdd6;
    }
    .desc-para { margin-bottom: 1.2em; }
    .desc-para:last-child { margin-bottom: 0; }
    .desc-lead {
      font-size: 1.2rem;
      font-weight: 600;
      color: #F5F5F5;
      line-height: 1.65;
      margin-bottom: 1.2em;
      border-left: 3px solid #00FF88;
      padding-left: 1.1rem;
    }
    h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 1rem; }
    .ticket-types { display: flex; flex-direction: column; gap: 1rem; }
    .tt-row {
      background: #111820; border: 1px solid #1e2836; border-radius: 12px;
      padding: 1.25rem 1.5rem; display: flex; align-items: center;
      justify-content: space-between; gap: 1rem; flex-wrap: wrap;
      cursor: pointer; transition: border-color 0.2s;
    }
    .tt-row:hover { border-color: #00FF8844; }
    .tt-row.selected { border-color: #00FF88; background: #0d1a15; }
    .tt-info h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .tt-info p { font-size: 0.85rem; color: #6b7a8d; }
    .tt-right { display: flex; align-items: center; gap: 1.5rem; }
    .price { font-size: 1.4rem; font-weight: 800; color: #22c55e; }
    .avail { font-size: 0.8rem; color: #6b7a8d; }
    .qty-row { display: flex; align-items: center; gap: 0.5rem; }
    .qty-btn { background: #1e2836; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .qty-btn:hover { background: #3e3e5e; }
    .qty { font-weight: 700; min-width: 24px; text-align: center; }
    .btn {
      background: #00FF88; color: #0b0f14; padding: 0.6rem 1.4rem; border-radius: 8px;
      font-weight: 700; font-size: 0.9rem; cursor: pointer; border: none;
      font-family: inherit; transition: background 0.2s; white-space: nowrap;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis;
    }
    .btn:hover { background: #00d474; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost {
      background: transparent; color: #6b7a8d; padding: 0.6rem 1rem; border-radius: 8px;
      font-weight: 600; font-size: 0.9rem; cursor: pointer; border: 1px solid #1e2836;
      font-family: inherit; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.4rem;
    }
    .btn-ghost:hover { background: #1e2836; color: #fff; }
    .sold-out { color: #ef4444; font-weight: 700; font-size: 0.9rem; }
    .loading { text-align: center; padding: 5rem; color: #6b7a8d; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 1rem; color: #fca5a5; }
    .toast {
      position: fixed; bottom: 2rem; right: 2rem;
      background: #1e3a1e; border: 1px solid #22c55e;
      color: #22c55e; padding: 0.75rem 1.5rem;
      border-radius: 10px; font-weight: 600; z-index: 999;
    }
    .buy-cta {
      margin-top: 2rem;
      padding: 2rem;
      background: #111820;
      border: 1px solid #1e2836;
      border-radius: 16px;
    }
    .buy-cta-total { font-size: 0.9rem; color: #6b7a8d; margin-bottom: 0.75rem; }
    .buy-cta-total strong { color: #F5F5F5; font-size: 1.15rem; }
    .buy-cta .btn-buy {
      width: 100%; background: #00FF88; color: #0b0f14;
      padding: 1rem; border-radius: 12px; font-weight: 800;
      font-size: 1.05rem; cursor: pointer; border: none;
      font-family: inherit; transition: background 0.2s;
    }
    .buy-cta .btn-buy:hover:not(:disabled) { background: #00d474; }
    .buy-cta .btn-buy:disabled { opacity: 0.4; cursor: not-allowed; }
    .buy-cta-hint { text-align: center; font-size: 0.78rem; color: #555568; margin-top: 0.5rem; }
    .recurring-badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      background: #0d1a15; border: 1px solid #00FF8833; color: #00FF88;
      border-radius: 999px; padding: 0.25rem 0.75rem;
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; margin-bottom: 0.75rem;
    }
      background: #1a1a2e; border-color: #00FF88; color: #a89cff;
    }
    /* Modal overlay */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center; z-index: 9999;
      padding: 1rem;
    }
    .modal {
      background: #12121c; border: 1px solid #1e2836; border-radius: 16px;
      padding: 2rem; width: 100%; max-width: 420px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,136,0.05);
    }
    .modal h3 { font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; }
    .modal p { color: #6b7a8d; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .modal-actions { display: flex; flex-direction: column; gap: 0.75rem; }
    .modal-actions .btn { width: 100%; text-align: center; }
    .modal-actions .btn-ghost { width: 100%; text-align: center; justify-content: center; }
    .input-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .input-group label { font-size: 0.85rem; color: #6b7a8d; }
    .input-group input {
      background: #111820; border: 1px solid #1e2836; border-radius: 8px;
      color: #fff; font-size: 1rem; padding: 0.75rem 1rem; font-family: inherit;
      width: 100%; box-sizing: border-box;
    }
    .input-group input:focus { outline: none; border-color: #00FF88; }
    .otp-hint { font-size: 0.8rem; color: #6b7a8d; text-align: center; margin-top: 0.5rem; }
    .modal-error { color: #f87171; font-size: 0.85rem; margin-bottom: 1rem; }
    /* Platform fee selector */
    .fee-section { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #1e2836; }
    .fee-section h4 { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.25rem; }
    .fee-section p { font-size: 0.8rem; color: #6b7a8d; margin-bottom: 0.75rem; }
    .fee-options { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .fee-btn {
      background: #111820; border: 1px solid #1e2836; border-radius: 8px;
      color: #aaa; font-size: 0.9rem; font-weight: 600; padding: 0.4rem 0.9rem;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .fee-btn.selected { background: #1e1e3e; border-color: #00FF88; color: #a89cff; }
    .fee-btn:hover { border-color: #00FF88; color: #fff; }
    .fee-note { font-size: 0.75rem; color: #555568; margin-top: 0.5rem; }
    /* Referral banner */
    .ref-banner {
      background: #1a1a2e; border: 1px solid #3e3e6e; border-radius: 8px;
      padding: 0.6rem 1rem; font-size: 0.82rem; color: #a89cff;
      margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;
    }
    @media (max-width: 640px) {
      :host { padding: 1rem; }
      .header h1 { font-size: 1.5rem; }
      .header-top { flex-direction: column; }
      .tt-row { flex-direction: column; align-items: flex-start; }
      .tt-right {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
        overflow: hidden;
      }
      .tt-right > .price { font-size: 1.2rem; }
      .qty-row { justify-content: space-between; }
      .btn {
        width: 100%;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: none;
        box-sizing: border-box;
      }
      .modal { padding: 1.5rem; }
    }
  `;

  @property() eventId = '';
  @state() event: any = null;
  @state() loading = true;
  @state() error = '';
  @state() quantities: Record<string, number> = {};
  @state() ordering: Record<string, boolean> = {};
  @state() toast = '';
  @state() toastClass = '';

  // Guest modal state
  @state() showModal = false;
  @state() otpStep: OtpStep = 'phone';
  @state() modalPhone = '';
  @state() modalCode = '';
  @state() modalError = '';
  @state() modalBusy = false;
  @state() pendingTt: any = null;
  @state() devCode = ''; // mock OTP hint

  // Platform fee
  @state() platformFee = 1;
  @state() private _countdown = '';
  private _countdownInterval?: ReturnType<typeof setInterval>;
  private readonly feeOptions = [0, 1, 2, 3, 5];

  // Referral code from URL
  private referralCode: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.referralCode = new URLSearchParams(window.location.search).get('ref');
    this._load();
    document.addEventListener('keydown', this._onKeyDown);
  }

  private async _load() {
    try {
      this.event = await api.getEvent(this.eventId);
      const q: Record<string, number> = {};
      // Default all ticket types to 0
      this.event?.ticketTypes?.forEach((tt: any) => { q[tt.id] = 0; });
      this.quantities = q;
      // No auto-selection needed — user picks qty to add
      document.title = `${this.event.name} — Slingshot`;
      this._startCountdown();
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  private _setQty(ttId: string, delta: number, max: number) {
    const cur = this.quantities[ttId] ?? 0;
    this.quantities = { ...this.quantities, [ttId]: Math.max(0, Math.min(max, cur + delta)) };
  }

  private async _buy() {
    if (!auth.isLoggedIn) {
      this.pendingTt = '__multi__';
      this.otpStep = 'phone';
      this.modalPhone = '';
      this.modalCode = '';
      this.modalError = '';
      this.devCode = '';
      this.showModal = true;
      return;
    }
    await this._placeOrder();
  }

  private async _placeOrder() {
    const items = Object.entries(this.quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    if (items.length === 0) return;

    this.ordering = { ...this.ordering, __multi__: true };
    try {
      const order = await api.createOrderMulti(items, this.platformFee, this.referralCode ?? undefined);
      navigate(`/checkout/${order.id}`);
    } catch (e: any) {
      this._showToast(e.message);
    } finally {
      this.ordering = { ...this.ordering, __multi__: false };
    }
  }

  private async _sendOtp() {
    if (!this.modalPhone) { this.modalError = 'Enter your phone number.'; return; }
    this.modalBusy = true;
    this.modalError = '';
    try {
      const res = await api.requestOtp(this.modalPhone);
      if (res.devCode) this.devCode = res.devCode;
      this.otpStep = 'code';
    } catch (e: any) {
      this.modalError = e.message;
    } finally {
      this.modalBusy = false;
    }
  }

  private async _verifyOtp() {
    if (!this.modalCode) { this.modalError = 'Enter the code from your phone.'; return; }
    this.modalBusy = true;
    this.modalError = '';
    try {
      const res = await api.verifyOtp(this.modalPhone, this.modalCode);
      auth.save(res.token, res.email, res.role);
      this.showModal = false;
      // Proceed with the order
      if (this.pendingTt) await this._placeOrder();
    } catch (e: any) {
      this.modalError = e.message;
    } finally {
      this.modalBusy = false;
    }
  }

  private async _share() {
    const ev = this.event;
    const slug = ev.slug || this.eventId;
    const url = `${window.location.origin}/events/${slug}`;
    const text = `🎟 ${ev.name} — ${new Date(ev.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ ${ev.venue?.name ?? 'Austin, TX'}`;
    if (navigator.share) {
      await navigator.share({ title: ev.name, text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this._showToast('Link copied!', 'toast-copy');
    }
  }

  private _showToast(msg: string, cls = '') {
    this.toast = msg;
    this.toastClass = cls;
    setTimeout(() => { this.toast = ''; }, 3500);
  }

  private _available(tt: any) {
    return tt.totalQuantity - tt.quantitySold;
  }

  private _startCountdown() {
    clearInterval(this._countdownInterval);
    if (!this.event?.saleStartsAt) return;
    const saleStart = new Date(this.event.saleStartsAt).getTime();
    if (saleStart <= Date.now()) return;
    this._countdownInterval = setInterval(() => {
      const diff = saleStart - Date.now();
      if (diff <= 0) {
        this._countdown = '';
        clearInterval(this._countdownInterval);
        this.requestUpdate();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this._countdown = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
    }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._countdownInterval);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.showModal) {
      this.showModal = false;
    }
  };

  override updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (changed.has('showModal') && this.showModal && this.otpStep === 'phone') {
      this.updateComplete.then(() => {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="tel"]');
        input?.focus();
      });
    }
    if (changed.has('otpStep') && this.otpStep === 'code') {
      this.updateComplete.then(() => {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="text"]');
        input?.focus();
      });
    }
  }

  private _getCurrentUserId(): string | null {
    try {
      const token = localStorage.getItem('jwt');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
        ?? payload.sub
        ?? null;
    } catch { return null; }
  }

  render() {
    if (this.loading) return html`
      <div style="max-width:700px;margin:0 auto;padding:2rem">
        <div style="height:24px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;margin-bottom:1.5rem;width:80px;animation:shimmer 1.5s infinite"></div>
        <div style="height:280px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:14px;margin-bottom:1.5rem;animation:shimmer 1.5s infinite"></div>
        <div style="height:2.5rem;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:8px;margin-bottom:1rem;width:70%;animation:shimmer 1.5s infinite"></div>
        <div style="height:1rem;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;margin-bottom:0.5rem;width:45%;animation:shimmer 1.5s infinite"></div>
        <div style="height:1rem;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:6px;margin-bottom:2rem;width:55%;animation:shimmer 1.5s infinite"></div>
        <div style="height:120px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:12px;margin-bottom:1rem;animation:shimmer 1.5s infinite"></div>
        <div style="height:120px;background:linear-gradient(90deg,#1a1a2e 25%,#232336 50%,#1a1a2e 75%);background-size:200% 100%;border-radius:12px;animation:shimmer 1.5s infinite"></div>
        <style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>
      </div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;
    const ev = this.event;

    const hasEnded = ev.endsAt
      ? new Date(ev.endsAt) < new Date()
      : new Date(ev.startsAt) < new Date();
    const isLocked = ev.isCancelled || hasEnded;

    const userId = this._getCurrentUserId();
    const isAdmin = auth.role === 'AppOwner' ||
      (auth.role === 'VenueAdmin' && !!userId && ev.venue?.ownerId === userId);

    return html`
      <div class="back" @click=${() => navigate('/events')}>← Back to Events</div>

      ${this.referralCode ? html`
        <div class="ref-banner">🔗 You were invited to this event</div>
      ` : ''}

      <div class="header">
        ${ev.thumbnailUrl ? html`
          ${ev.cdnImageBase
            ? html`<img
                src="${ev.cdnImageBase}/img/900x450/cover/${ev.id}.jpg"
                srcset="${ev.cdnImageBase}/img/640x320/cover/${ev.id}.jpg 640w, ${ev.cdnImageBase}/img/900x450/cover/${ev.id}.jpg 900w, ${ev.cdnImageBase}/img/1200x630/cover/${ev.id}.jpg 1200w"
                sizes="(max-width: 640px) 100vw, 900px"
                alt=${ev.name} loading="lazy"
                style="width:100%;max-height:320px;object-fit:cover;border-radius:14px;margin-bottom:1.5rem" />`
            : html`<img src=${ev.thumbnailUrl} alt=${ev.name} loading="lazy"
                style="width:100%;max-height:320px;object-fit:cover;border-radius:14px;margin-bottom:1.5rem" />`}
        ` : ''}
        <div class="header-top">
          <div>
            <h1>${ev.name}</h1>
            ${ev.recurringRule ? html`<div class="recurring-badge">↻ ${ev.recurringRule.charAt(0) + ev.recurringRule.slice(1).toLowerCase()}</div>` : ''}
            <div class="meta">
              <span>📍 ${ev.venue?.name ?? 'Austin, TX'}</span>
              <span>📅 ${new Date(ev.startsAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-shrink:0;align-items:flex-start">
            ${isAdmin ? html`
              <button class="btn-ghost" @click=${() => navigate('/venue/events/' + this.eventId)}>⚙ Manage</button>
            ` : ''}
            <button class="btn-ghost" @click=${this._share}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          </div>
        </div>
        <div class="desc">
          ${ev.description?.split('\n').filter(Boolean).map((para: string, i: number) => html`
            <p class="${i === 0 ? 'desc-lead' : 'desc-para'}">${para}</p>
          `)}
        </div>
      </div>

      <h2>Tickets</h2>

      ${ev.isCancelled ? html`
        <div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:0.75rem">
          <span style="font-size:1.3rem">🚫</span>
          <div>
            <div style="font-weight:700;color:#ef4444;margin-bottom:0.2rem">This event has been cancelled</div>
            <div style="font-size:0.85rem;color:#6b7a8d">${ev.cancellationReason ?? 'All ticket holders will be refunded automatically.'}</div>
          </div>
          <a href="/events" style="margin-left:auto;background:#1e2836;color:#F5F5F5;border:none;padding:0.5rem 1rem;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap">Browse Events</a>
        </div>
      ` : html`
      ${hasEnded ? html`
        <div style="background:#1a0a0a;border:1px solid #3d1515;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:0.75rem">
          <span style="font-size:1.3rem">🚫</span>
          <div>
            <div style="font-weight:700;color:#ef4444;margin-bottom:0.2rem">This event has ended</div>
            <div style="font-size:0.85rem;color:#6b7a8d">Ticket sales are closed. Check out upcoming events!</div>
          </div>
          <a href="/events" style="margin-left:auto;background:#1e2836;color:#F5F5F5;border:none;padding:0.5rem 1rem;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap">Browse Events</a>
        </div>
      ` : ''}`}

      <div class="ticket-types">
        ${ev.ticketTypes?.map((tt: any) => {
          const avail = this._available(tt);
          const qty = this.quantities[tt.id] ?? 0;
          const hasQty = qty > 0;
          return html`
            <div class="tt-row ${hasQty && !isLocked ? 'selected' : ''}">
              <div class="tt-info">
                <h3 style="${isLocked ? 'color:#6b7a8d' : ''}">${tt.name}</h3>
                <p>${isLocked ? html`<span style="color:#6b7a8d">N/A</span>` : html`$${tt.price.toFixed(2)} each · Max ${tt.maxPerOrder} per order · ${avail > 0 ? `${avail} left` : 'Sold out'}`}</p>
              </div>
              <div class="tt-right">
                ${isLocked ? html`<div class="sold-out" style="color:#6b7a8d;border-color:#6b7a8d">${ev.isCancelled ? 'Cancelled' : 'Ended'}</div>` : avail > 0 ? html`
                  <div class="qty-row">
                    <button class="qty-btn" @click=${() => this._setQty(tt.id, -1, tt.maxPerOrder)}>−</button>
                    <span class="qty">${qty}</span>
                    <button class="qty-btn" @click=${() => this._setQty(tt.id, 1, tt.maxPerOrder)}>+</button>
                  </div>
                ` : html`<div class="sold-out">Sold Out</div>`}
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Platform fee contribution selector -->
      <div class="fee-section">
        <h4>Help keep Slingshot free</h4>
        <p>We charge zero fees by default. Add an optional contribution to keep the lights on.</p>
        <div class="fee-options">
          ${this.feeOptions.map(f => html`
            <button class="fee-btn ${this.platformFee === f ? 'selected' : ''}"
              @click=${() => { this.platformFee = f; this.requestUpdate(); }}>
              ${f === 0 ? 'No thanks' : `+$${f}`}
            </button>
          `)}
        </div>
        ${this.platformFee > 0 ? html`
          <p class="fee-note">Thank you! Your $${this.platformFee} contribution helps us stay fee-free for everyone.</p>
        ` : html`
          <p class="fee-note">No worries — no fees, no hidden charges. Enjoy the show! 🤠</p>
        `}
      </div>

      <!-- Order summary + buy CTA -->
      ${!isLocked ? (() => {
        const lineItems = ev.ticketTypes?.filter((tt: any) => (this.quantities[tt.id] ?? 0) > 0) ?? [];
        const ticketTotal = lineItems.reduce((s: number, tt: any) => s + tt.price * (this.quantities[tt.id] ?? 0), 0);
        const grandTotal = (ticketTotal + this.platformFee).toFixed(2);
        const hasItems = lineItems.length > 0;
        const busy = this.ordering['__multi__'] ?? false;
        return html`
          <div class="buy-cta">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${hasItems ? '0.75rem' : '0'}">
              <span style="font-weight:700;font-size:1rem">Order Summary</span>
              ${hasItems ? html`<span style="font-weight:800;font-size:1.15rem;color:#F5F5F5">$${grandTotal}</span>` : ''}
            </div>
            ${hasItems ? html`
              <div style="margin-bottom:1rem">
                ${lineItems.map((tt: any) => {
                  const qty = this.quantities[tt.id] ?? 0;
                  const sub = (tt.price * qty).toFixed(2);
                  return html`
                    <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:#c8cdd6;padding:0.2rem 0">
                      <span>${qty}× ${tt.name}</span>
                      <span>$${sub}</span>
                    </div>
                  `;
                })}
                ${this.platformFee > 0 ? html`
                  <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:#6b7a8d;padding:0.2rem 0;border-top:1px solid #1e2836;margin-top:0.4rem;padding-top:0.4rem">
                    <span>Slingshot tip 💚</span>
                    <span>$${this.platformFee.toFixed(2)}</span>
                  </div>
                ` : ''}
              </div>
            ` : html`<p class="buy-cta-total" style="margin-bottom:0.75rem">Add tickets above to get started</p>`}
            ${this.event?.saleStartsAt && new Date(this.event.saleStartsAt) > new Date() ? html`
              <div style="background:#1a1a2e;border:1px solid #2d2d4e;border-radius:10px;padding:1rem;text-align:center;margin-bottom:0.75rem">
                <div style="font-weight:700;color:#F5F5F5;margin-bottom:0.25rem">🔒 Tickets not on sale yet</div>
                <div style="font-size:0.85rem;color:#6b7a8d">Goes on sale ${new Date(this.event.saleStartsAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                ${this._countdown ? html`<div style="font-size:1.3rem;font-weight:900;color:#00FF88;margin-top:0.5rem;font-variant-numeric:tabular-nums">${this._countdown}</div>` : ''}
              </div>
              <button class="btn-buy" disabled>Coming Soon</button>
            ` : html`
              <button class="btn-buy" ?disabled=${!hasItems || busy} @click=${() => this._buy()}>
                ${busy ? 'Processing...' : hasItems ? 'Buy Tickets →' : 'Select Tickets'}
              </button>
            `}
            <p class="buy-cta-hint">Secure checkout · No hidden fees</p>
          </div>
        `;
      })() : ''}

      ${this.showModal ? this._renderModal() : ''}
      ${this.toast ? html`<div class="toast ${this.toastClass}">${this.toast}</div>` : ''}
    `;
  }

  private _renderModal() {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this.showModal = false; }}>
        <div class="modal">
          <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;justify-content:center">
            <div style="padding:0.3rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:700;${this.otpStep === 'phone' ? 'background:#0d1a15;color:#00FF88;border:1px solid #00FF8855' : 'background:#1e2836;color:#6b7a8d'}">
              1 · Phone
            </div>
            <div style="padding:0.3rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:700;${this.otpStep === 'code' ? 'background:#0d1a15;color:#00FF88;border:1px solid #00FF8855' : 'background:#1e2836;color:#6b7a8d'}">
              2 · Code
            </div>
          </div>
          ${this.otpStep === 'phone' ? html`
            <h3>Get your tickets</h3>
            <p>Sign in or continue as a guest with your phone number — no account needed.</p>
            ${this.modalError ? html`<div class="modal-error">${this.modalError}</div>` : ''}
            <div class="input-group">
              <label>Phone number</label>
              <input type="tel" placeholder="+1 (512) 555-0100"
                .value=${this.modalPhone}
                @input=${(e: any) => { this.modalPhone = e.target.value; }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._sendOtp(); }}/>
            </div>
            <div class="modal-actions">
              <button class="btn" ?disabled=${this.modalBusy} @click=${this._sendOtp}>
                ${this.modalBusy ? 'Sending…' : 'Send code'}
              </button>
              <button class="btn-ghost" @click=${() => { this.showModal = false; navigate('/login'); }}>
                Sign in with email instead
              </button>
            </div>
          ` : html`
            <h3>Enter your code</h3>
            <p>We sent a 6-digit code to ${this.modalPhone}.</p>
            ${this.devCode ? html`<p class="otp-hint">🧪 Dev mode — your code is <strong>${this.devCode}</strong></p>` : ''}
            ${this.modalError ? html`<div class="modal-error">${this.modalError}</div>` : ''}
            <div class="input-group">
              <label>6-digit code</label>
              <input type="text" inputmode="numeric" maxlength="6" placeholder="123456"
                .value=${this.modalCode}
                @input=${(e: any) => { this.modalCode = e.target.value; }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._verifyOtp(); }}/>
            </div>
            <div class="modal-actions">
              <button class="btn" ?disabled=${this.modalBusy} @click=${this._verifyOtp}>
                ${this.modalBusy ? 'Verifying…' : 'Continue'}
              </button>
              <button class="btn-ghost" @click=${() => { this.otpStep = 'phone'; this.modalError = ''; }}>
                ← Change number
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }
}

