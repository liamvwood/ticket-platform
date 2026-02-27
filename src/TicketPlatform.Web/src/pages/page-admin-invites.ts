import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { auth, navigate } from '../services/auth.js';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080';

async function apiReq<T>(method: string, path: string, body?: object): Promise<T> {
  const token = localStorage.getItem('jwt');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text)?.error ?? text; } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  try { return JSON.parse(text); } catch { return null as T; }
}

@customElement('page-admin-invites')
export class PageAdminInvites extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.25rem; }
    .sub { color: #8888a8; margin-bottom: 2rem; font-size: 0.95rem; }
    .card { background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 14px; padding: 1.75rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1.25rem; }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #ccc; margin-bottom: 0.35rem; }
    input { width: 100%; background: #22222f; border: 1px solid #2e2e3e; color: #f0f0f8; border-radius: 8px; padding: 0.65rem 0.9rem; font-size: 0.95rem; box-sizing: border-box; font-family: inherit; }
    input:focus { outline: none; border-color: #6c63ff; }
    .btn { background: #6c63ff; color: #fff; padding: 0.7rem 1.5rem; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; font-family: inherit; font-size: 0.95rem; }
    .btn:hover:not(:disabled) { background: #5a52e0; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-sm { background: transparent; border: 1px solid #444; color: #ccc; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-family: inherit; }
    .btn-sm:hover { border-color: #888; color: #fff; }
    .btn-danger { border-color: #7f1d1d; color: #fca5a5; }
    .btn-danger:hover { background: #450a0a; border-color: #fca5a5; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 0.75rem 1rem; color: #fca5a5; font-size: 0.9rem; margin-bottom: 1rem; }
    .success { background: #052e16; border: 1px solid #166534; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .invite-url { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
    .invite-url input { flex: 1; font-family: monospace; font-size: 0.85rem; color: #a5b4fc; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; color: #8888a8; font-weight: 600; font-size: 0.8rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid #2e2e3e; }
    td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #1e1e2e; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; }
    .badge-pending { background: #1e3a5f; color: #93c5fd; }
    .badge-used { background: #052e16; color: #86efac; }
    .badge-expired { background: #292524; color: #a8a29e; }
    .empty { color: #555570; text-align: center; padding: 2rem; }
    .row-actions { display: flex; gap: 0.5rem; }
  `;

  @state() email = '';
  @state() venueName = '';
  @state() loading = false;
  @state() error = '';
  @state() newInviteUrl = '';
  @state() newInviteEmail = '';
  @state() invites: any[] = [];

  connectedCallback() {
    super.connectedCallback();
    if (auth.role !== 'AppOwner') { navigate('/'); return; }
    this._loadInvites();
  }

  private async _loadInvites() {
    try {
      this.invites = await apiReq<any[]>('GET', '/admin/invites');
    } catch {}
  }

  private async _createInvite(e: Event) {
    e.preventDefault();
    this.error = '';
    this.newInviteUrl = '';
    this.loading = true;
    try {
      const res = await apiReq<any>('POST', '/admin/invites', { email: this.email, venueName: this.venueName });
      this.newInviteUrl = res.inviteUrl;
      this.newInviteEmail = res.email;
      this.email = '';
      this.venueName = '';
      await this._loadInvites();
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  private async _revoke(id: string) {
    try {
      await apiReq('DELETE', `/admin/invites/${id}`);
      await this._loadInvites();
    } catch (err: any) {
      this.error = err.message;
    }
  }

  private _copy(url: string) {
    navigator.clipboard.writeText(url);
  }

  private _fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  render() {
    return html`
      <h1>Venue Invites</h1>
      <p class="sub">Generate invite links to onboard new venue owners. Each link is single-use and expires in 7 days.</p>

      <div class="card">
        <h2>Send a new invite</h2>
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.newInviteUrl ? html`
          <div class="success">
            <strong>Invite created for ${this.newInviteEmail}</strong>
            <div class="invite-url">
              <input type="text" readonly .value=${this.newInviteUrl} />
              <button class="btn-sm" @click=${() => this._copy(this.newInviteUrl)}>Copy</button>
            </div>
            <p style="color:#86efac;font-size:0.85rem;margin:0.5rem 0 0">Share this link with the venue owner. It expires in 7 days.</p>
          </div>
        ` : ''}
        <form @submit=${this._createInvite}>
          <div class="field">
            <label>Venue owner's email</label>
            <input type="email" .value=${this.email} @input=${(e: any) => this.email = e.target.value} placeholder="owner@venuename.com" required />
          </div>
          <div class="field">
            <label>Venue name</label>
            <input type="text" .value=${this.venueName} @input=${(e: any) => this.venueName = e.target.value} placeholder="Stubb's Waller Creek Amphitheater" required />
          </div>
          <button class="btn" type="submit" ?disabled=${this.loading}>
            ${this.loading ? 'Creating…' : 'Generate Invite Link'}
          </button>
        </form>
      </div>

      <div class="card">
        <h2>All invites</h2>
        ${this.invites.length === 0 ? html`
          <p class="empty">No invites yet.</p>
        ` : html`
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Venue</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${this.invites.map(inv => html`
                <tr>
                  <td>${inv.email}</td>
                  <td>${inv.venueName}</td>
                  <td>${this._fmtDate(inv.createdAt)}</td>
                  <td>${this._fmtDate(inv.expiresAt)}</td>
                  <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
                  <td>
                    <div class="row-actions">
                      ${inv.status === 'pending' ? html`
                        <button class="btn-sm btn-danger" @click=${() => this._revoke(inv.id)}>Revoke</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }
}
