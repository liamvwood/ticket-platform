import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

type OtpStep = 'phone' | 'code' | 'done';

@customElement('page-event-detail')
export class PageEventDetail extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 900px; margin: 0 auto; }
    .back { color: #8888a8; cursor: pointer; font-size: 0.9rem; margin-bottom: 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .back:hover { color: #fff; }
    .header { margin-bottom: 2rem; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .header h1 { font-size: 2.2rem; font-weight: 900; margin-bottom: 0.5rem; }
    .meta { display: flex; gap: 1.5rem; flex-wrap: wrap; color: #8888a8; font-size: 0.9rem; margin-bottom: 1rem; }
    .meta span { display: flex; align-items: center; gap: 0.4rem; }
    .desc { color: #aaa; line-height: 1.8; margin-bottom: 2rem; }
    h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 1rem; }
    .ticket-types { display: flex; flex-direction: column; gap: 1rem; }
    .tt-row {
      background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 12px;
      padding: 1.25rem 1.5rem; display: flex; align-items: center;
      justify-content: space-between; gap: 1rem; flex-wrap: wrap;
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
      background: #6c63ff; color: #fff; padding: 0.6rem 1.4rem; border-radius: 8px;
      font-weight: 700; font-size: 0.9rem; cursor: pointer; border: none;
      font-family: inherit; transition: background 0.2s; white-space: nowrap;
    }
    .btn:hover { background: #5a52e0; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost {
      background: transparent; color: #8888a8; padding: 0.6rem 1rem; border-radius: 8px;
      font-weight: 600; font-size: 0.9rem; cursor: pointer; border: 1px solid #2e2e3e;
      font-family: inherit; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.4rem;
    }
    .btn-ghost:hover { background: #2e2e3e; color: #fff; }
    .sold-out { color: #ef4444; font-weight: 700; font-size: 0.9rem; }
    .loading { text-align: center; padding: 5rem; color: #8888a8; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 1rem; color: #fca5a5; }
    .toast {
      position: fixed; bottom: 2rem; right: 2rem;
      background: #1e3a1e; border: 1px solid #22c55e;
      color: #22c55e; padding: 0.75rem 1.5rem;
      border-radius: 10px; font-weight: 600; z-index: 999;
    }
    /* Share copied toast */
    .toast-copy {
      background: #1a1a2e; border-color: #6c63ff; color: #a89cff;
    }
    /* Modal overlay */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center; z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: #12121c; border: 1px solid #2e2e3e; border-radius: 16px;
      padding: 2rem; width: 100%; max-width: 420px;
    }
    .modal h3 { font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; }
    .modal p { color: #8888a8; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .modal-actions { display: flex; flex-direction: column; gap: 0.75rem; }
    .modal-actions .btn { width: 100%; text-align: center; }
    .modal-actions .btn-ghost { width: 100%; text-align: center; justify-content: center; }
    .input-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .input-group label { font-size: 0.85rem; color: #8888a8; }
    .input-group input {
      background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 8px;
      color: #fff; font-size: 1rem; padding: 0.75rem 1rem; font-family: inherit;
      width: 100%; box-sizing: border-box;
    }
    .input-group input:focus { outline: none; border-color: #6c63ff; }
    .otp-hint { font-size: 0.8rem; color: #8888a8; text-align: center; margin-top: 0.5rem; }
    .modal-error { color: #f87171; font-size: 0.85rem; margin-bottom: 1rem; }
    /* Platform fee selector */
    .fee-section { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #2e2e3e; }
    .fee-section h4 { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.25rem; }
    .fee-section p { font-size: 0.8rem; color: #8888a8; margin-bottom: 0.75rem; }
    .fee-options { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .fee-btn {
      background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 8px;
      color: #aaa; font-size: 0.9rem; font-weight: 600; padding: 0.4rem 0.9rem;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .fee-btn.selected { background: #1e1e3e; border-color: #6c63ff; color: #a89cff; }
    .fee-btn:hover { border-color: #6c63ff; color: #fff; }
    .fee-note { font-size: 0.75rem; color: #555568; margin-top: 0.5rem; }
    /* Referral banner */
    .ref-banner {
      background: #1a1a2e; border: 1px solid #3e3e6e; border-radius: 8px;
      padding: 0.6rem 1rem; font-size: 0.82rem; color: #a89cff;
      margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;
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
  private readonly feeOptions = [0, 1, 2, 3, 5];

  // Referral code from URL
  private referralCode: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.referralCode = new URLSearchParams(window.location.search).get('ref');
    this._load();
  }

  private async _load() {
    try {
      this.event = await api.getEvent(this.eventId);
      const q: Record<string, number> = {};
      this.event?.ticketTypes?.forEach((tt: any) => { q[tt.id] = 1; });
      this.quantities = q;
      // Update page title + meta for bots that execute JS
      document.title = `${this.event.name} — Austin Tickets`;
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
    if (!auth.isLoggedIn) {
      this.pendingTt = tt;
      this.otpStep = 'phone';
      this.modalPhone = '';
      this.modalCode = '';
      this.modalError = '';
      this.devCode = '';
      this.showModal = true;
      return;
    }
    await this._placeOrder(tt);
  }

  private async _placeOrder(tt: any) {
    this.ordering = { ...this.ordering, [tt.id]: true };
    try {
      const qty = this.quantities[tt.id] ?? 1;
      const order = await api.createOrder(tt.id, qty, this.platformFee, this.referralCode ?? undefined);
      navigate(`/checkout/${order.id}`);
    } catch (e: any) {
      this._showToast(e.message);
    } finally {
      this.ordering = { ...this.ordering, [tt.id]: false };
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
      if (this.pendingTt) await this._placeOrder(this.pendingTt);
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

  render() {
    if (this.loading) return html`<div class="loading">Loading event…</div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;
    const ev = this.event;

    return html`
      <div class="back" @click=${() => navigate('/events')}>← Back to Events</div>

      ${this.referralCode ? html`
        <div class="ref-banner">🔗 You were invited to this event</div>
      ` : ''}

      <div class="header">
        <div class="header-top">
          <div>
            <h1>${ev.name}</h1>
            <div class="meta">
              <span>📍 ${ev.venue?.name ?? 'Austin, TX'}</span>
              <span>📅 ${new Date(ev.startsAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
            </div>
          </div>
          <button class="btn-ghost" @click=${this._share}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
        <p class="desc">${ev.description}</p>
      </div>

      <h2>Tickets</h2>

      <div class="ticket-types">
        ${ev.ticketTypes?.map((tt: any) => {
          const avail = this._available(tt);
          const qty = this.quantities[tt.id] ?? 1;
          const total = (tt.price * qty + this.platformFee).toFixed(2);
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
                    ${this.ordering[tt.id] ? 'Processing…' : `Buy · $${total}`}
                  </button>
                ` : html`<div class="sold-out">Sold Out</div>`}
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Platform fee contribution selector -->
      <div class="fee-section">
        <h4>Help keep Austin Tickets free</h4>
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

      ${this.showModal ? this._renderModal() : ''}
      ${this.toast ? html`<div class="toast ${this.toastClass}">${this.toast}</div>` : ''}
    `;
  }

  private _renderModal() {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this.showModal = false; }}>
        <div class="modal">
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

