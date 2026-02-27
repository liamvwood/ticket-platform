import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

type ScanStatus = 'idle' | 'scanning' | 'done';
type QrResult = { status: string; message: string; ticketId?: string; eventName?: string; ticketType?: string };

@customElement('page-scanner')
export class PageScanner extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 560px; margin: 0 auto; }
    h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; }
    .sub { color: #8888a8; margin-bottom: 2rem; }
    .scanner-box {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
    }
    #reader {
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }
    .btn {
      background: #6c63ff;
      color: #fff;
      padding: 0.75rem 2rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
    }
    .btn:hover:not(:disabled) { background: #5a52e0; }
    .btn-stop { background: #374151; }
    .btn-stop:hover { background: #4b5563; }
    .result {
      margin-top: 1.5rem;
      padding: 1.5rem;
      border-radius: 12px;
      text-align: center;
    }
    .result.Valid    { background: #14532d; border: 1px solid #22c55e; }
    .result.Duplicate{ background: #451a03; border: 1px solid #f59e0b; }
    .result.Invalid  { background: #450a0a; border: 1px solid #ef4444; }
    .result.Refunded { background: #1e1e2e; border: 1px solid #6b7280; }
    .result-icon { margin-bottom: 0.5rem; display: flex; justify-content: center; }
    .result-icon.Valid    { color: #4ade80; }
    .result-icon.Duplicate{ color: #f59e0b; }
    .result-icon.Invalid  { color: #ef4444; }
    .result-icon.Refunded { color: #9ca3af; }
    .result-status { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.4rem; }
    .result-msg { font-size: 0.9rem; color: #aaa; }
    .result-detail { margin-top: 0.75rem; font-size: 0.85rem; color: #ccc; }
    .manual { margin-top: 1.5rem; }
    .manual h3 { font-size: 0.9rem; font-weight: 700; color: #8888a8; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: .05em; }
    .manual-row { display: flex; gap: .75rem; }
    input { background: #22222f; border: 1px solid #2e2e3e; color: #f0f0f8; border-radius: 8px; padding: .65rem 1rem; font-size: .9rem; flex: 1; font-family: inherit; box-sizing: border-box; }
    input:focus { outline: none; border-color: #6c63ff; }
    .auth-warn { background: #451a03; border: 1px solid #78350f; border-radius: 12px; padding: 2rem; text-align: center; color: #fbbf24; }
    .auth-warn h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: .5rem; }
    .auth-warn p { font-size: .9rem; color: #d97706; }
  `;

  @state() scanState: ScanStatus = 'idle';
  @state() result: QrResult | null = null;
  @state() manualToken = '';
  private _scanner: any = null;

  get _canScan() {
    const r = auth.role;
    return r === 'Scanner' || r === 'VenueAdmin';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopScanner();
  }

  private async _startScanner() {
    const { Html5Qrcode } = await import('html5-qrcode');
    this.scanState = 'scanning';
    await this.updateComplete;
    const el = this.shadowRoot?.getElementById('reader');
    if (!el) return;
    this._scanner = new Html5Qrcode('reader', { verbose: false } as any);
    // Html5Qrcode needs a DOM id in the light DOM — use a wrapper div
    try {
      await this._scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded: string) => this._onScan(decoded),
        undefined
      );
    } catch {
      // Camera not available in this env; allow manual entry
      this.scanState = 'idle';
    }
  }

  private async _stopScanner() {
    if (this._scanner) {
      try { await this._scanner.stop(); } catch {}
      this._scanner = null;
    }
    this.scanState = 'idle';
  }

  private async _onScan(token: string) {
    await this._stopScanner();
    await this._validate(token);
  }

  private async _validate(token: string) {
    this.result = null;
    try {
      const res = await api.validateQr(token);
      this.result = res as QrResult;
    } catch (e: any) {
      this.result = { status: 'Invalid', message: e.message };
    }
    this.scanState = 'done';
  }

  private _resultIcon(status: string) {
    const map: Record<string, string> = { Valid: icons.checkCircle, Duplicate: icons.alertCircle, Invalid: icons.xCircle, Refunded: icons.refresh };
    return map[status] ?? icons.alertCircle;
  }

  render() {
    if (!auth.isLoggedIn) return html`
      <div class="auth-warn">
        <h2>Authentication Required</h2>
        <p>Please <a style="color:#f59e0b;cursor:pointer" @click=${() => navigate('/login')}>log in</a> with a Scanner or VenueAdmin account.</p>
      </div>
    `;

    if (!this._canScan) return html`
      <div class="auth-warn">
        <h2>Access Denied</h2>
        <p>This page requires a Scanner or VenueAdmin role.</p>
      </div>
    `;

    return html`
      <h1>Ticket Scanner</h1>
      <p class="sub">Scan QR codes or enter a token manually to validate tickets.</p>

      <div class="scanner-box">
        <div id="reader"></div>

        ${this.scanState === 'idle' || this.scanState === 'done' ? html`
          <button class="btn" @click=${this._startScanner}>Start Camera Scan</button>
        ` : html`
          <button class="btn btn-stop" @click=${this._stopScanner}>Stop Scanner</button>
        `}

        ${this.result ? html`
          <div class="result ${this.result.status}">
            <div class="result-icon ${this.result.status}" .innerHTML=${this._resultIcon(this.result.status)}></div>
            <div class="result-status">${this.result.status}</div>
            <div class="result-msg">${this.result.message}</div>
            ${this.result.eventName ? html`
              <div class="result-detail">
                ${this.result.ticketType} &middot; ${this.result.eventName}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="manual">
          <h3>Manual Token Entry</h3>
          <div class="manual-row">
            <input type="text" placeholder="Paste QR token…" .value=${this.manualToken}
              @input=${(e: any) => this.manualToken = e.target.value}
              @keydown=${(e: any) => e.key === 'Enter' && this._validate(this.manualToken)} />
            <button class="btn" @click=${() => this._validate(this.manualToken)}>Validate</button>
          </div>
        </div>
      </div>
    `;
  }
}
