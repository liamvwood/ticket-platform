import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { auth, navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080';

@customElement('page-invite-accept')
export class PageInviteAccept extends LitElement {
  static styles = css`
    :host { display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 2rem; }
    .box {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 440px;
    }
    .logo { text-align: center; margin-bottom: 0.5rem; color: #6c63ff; display: flex; justify-content: center; }
    h1 { text-align: center; font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; }
    .venue-name { text-align: center; color: #6c63ff; font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .sub { text-align: center; color: #8888a8; font-size: 0.9rem; margin-bottom: 2rem; }
    .field { margin-bottom: 1.1rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #ccc; margin-bottom: 0.35rem; }
    input { width: 100%; background: #22222f; border: 1px solid #2e2e3e; color: #f0f0f8; border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.95rem; box-sizing: border-box; font-family: inherit; transition: border-color 0.2s; }
    input:focus { outline: none; border-color: #6c63ff; }
    input:read-only { opacity: 0.7; cursor: default; }
    .btn { width: 100%; background: #6c63ff; color: #fff; padding: 0.8rem; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; border: none; font-family: inherit; transition: background 0.2s; margin-top: 0.5rem; }
    .btn:hover:not(:disabled) { background: #5a52e0; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 0.75rem 1rem; color: #fca5a5; font-size: 0.9rem; margin-bottom: 1rem; }
    .info { background: #0f1f3d; border: 1px solid #1e3a5f; border-radius: 8px; padding: 0.75rem 1rem; color: #93c5fd; font-size: 0.9rem; margin-bottom: 1.25rem; }
    .spinner { text-align: center; color: #8888a8; padding: 4rem; }
    .expired { text-align: center; padding: 3rem 1rem; color: #8888a8; }
    .expired h2 { color: #fca5a5; margin-bottom: 0.5rem; }
    .hint { font-size: 0.8rem; color: #555570; margin-top: 0.3rem; }
    .expiry { font-size: 0.8rem; color: #555570; text-align: right; margin-top: 0.35rem; }
  `;

  @property() token = '';

  @state() loading = true;
  @state() submitting = false;
  @state() error = '';
  @state() invite: { email: string; venueName: string; expiresAt: string } | null = null;
  @state() inviteError = '';
  @state() password = '';
  @state() phone = '';

  async connectedCallback() {
    super.connectedCallback();
    await this._loadInvite();
  }

  private async _loadInvite() {
    this.loading = true;
    try {
      const res = await fetch(`${API}/invites/${this.token}`);
      const data = await res.json();
      if (!res.ok) {
        this.inviteError = data.error ?? `Error ${res.status}`;
      } else {
        this.invite = data;
      }
    } catch {
      this.inviteError = 'Could not load invite. Please check your link.';
    } finally {
      this.loading = false;
    }
  }

  private async _accept(e: Event) {
    e.preventDefault();
    if (!this.invite) return;
    this.error = '';
    this.submitting = true;
    try {
      const res = await fetch(`${API}/invites/${this.token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: this.password, phoneNumber: this.phone || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.error = data.error ?? `Error ${res.status}`;
        return;
      }
      auth.save(data.token, data.email, data.role);
      navigate('/venue');
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.submitting = false;
    }
  }

  private _fmtExpiry(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  render() {
    if (this.loading) {
      return html`<div class="spinner">Verifying your invite…</div>`;
    }

    if (this.inviteError) {
      return html`
        <div class="box">
          <div class="logo" .innerHTML=${icons.ticket}></div>
          <div class="expired">
            <h2>${this.inviteError.includes('expired') ? 'Invite Expired' : 'Invalid Invite'}</h2>
            <p>${this.inviteError}</p>
            <p>Contact the platform owner to request a new invite link.</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="box">
        <div class="logo" .innerHTML=${icons.ticket}></div>
        <h1>You're invited!</h1>
        <p class="venue-name">${this.invite!.venueName}</p>
        <p class="sub">Set up your venue admin account to start selling tickets on Austin Tickets.</p>

        <div class="info">
          You've been invited to manage <strong>${this.invite!.venueName}</strong>.<br>
          A venue and dashboard will be created automatically when you sign up.
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        <form @submit=${this._accept}>
          <div class="field">
            <label>Email</label>
            <input type="email" .value=${this.invite!.email} readonly />
          </div>
          <div class="field">
            <label>Password</label>
            <input
              type="password"
              .value=${this.password}
              @input=${(e: any) => this.password = e.target.value}
              placeholder="Choose a strong password"
              minlength="8"
              required />
            <p class="hint">At least 8 characters.</p>
          </div>
          <div class="field">
            <label>Phone number <span style="color:#555570">(optional)</span></label>
            <input
              type="tel"
              .value=${this.phone}
              @input=${(e: any) => this.phone = e.target.value}
              placeholder="+1 (512) 555-0100" />
          </div>
          <button class="btn" type="submit" ?disabled=${this.submitting}>
            ${this.submitting ? 'Creating account…' : 'Create Venue Account'}
          </button>
        </form>
        <p class="expiry">Invite expires ${this._fmtExpiry(this.invite!.expiresAt)}</p>
      </div>
    `;
  }
}
