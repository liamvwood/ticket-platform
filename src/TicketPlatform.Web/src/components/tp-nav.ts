import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { auth, navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

@customElement('tp-nav')
export class TpNav extends LitElement {
  static styles = css`
    nav {
      background: #13131c;
      border-bottom: 1px solid #2e2e3e;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      font-size: 1.2rem;
      font-weight: 800;
      color: #6c63ff;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .brand svg { color: #6c63ff; }
    .links { display: flex; align-items: center; gap: 1.5rem; }
    .links a {
      color: #aaa;
      font-size: 0.9rem;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      font-family: inherit;
      transition: color 0.2s;
    }
    .links a:hover { color: #fff; }
    .btn {
      background: #6c63ff;
      color: #fff;
      border-radius: 6px;
      padding: 0.4rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
    }
    .btn:hover { background: #5a52e0; }
    .btn-ghost {
      background: transparent;
      border: 1px solid #2e2e3e;
      color: #ccc;
    }
    .btn-ghost:hover { border-color: #666; color: #fff; }
  `;

  @property({ type: Boolean }) loggedIn = false;
  @property({ type: String }) role = '';

  connectedCallback() {
    super.connectedCallback();
    this._sync();
    window.addEventListener('auth-change', this._sync);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('auth-change', this._sync);
  }
  private _sync = () => {
    this.loggedIn = auth.isLoggedIn;
    this.role = auth.role ?? '';
  };

  render() {
    return html`
      <nav>
        <div class="brand" @click=${() => navigate('/')}>
          <span .innerHTML=${icons.ticket}></span>
          Austin Tickets
        </div>
        <div class="links">
          <a @click=${() => navigate('/events')}>Events</a>
          ${this.loggedIn ? html`
            <a @click=${() => navigate('/my-tickets')}>My Tickets</a>
            ${this.role === 'VenueAdmin' ? html`<a @click=${() => navigate('/venue')}>Venue Portal</a>` : ''}
            ${this.role === 'Scanner' || this.role === 'VenueAdmin' ? html`<a @click=${() => navigate('/scan')}>Scanner</a>` : ''}
            ${this.role === 'AppOwner' ? html`<a @click=${() => navigate('/admin/invites')}>Admin</a>` : ''}
            <button class="btn btn-ghost" @click=${() => auth.logout()}>Logout</button>
          ` : html`
            <a @click=${() => navigate('/login')}>Login</a>
            <button class="btn" @click=${() => navigate('/register')}>Get Started</button>
          `}
        </div>
      </nav>
    `;
  }
}
