import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

// Import all pages so custom elements are registered
import './pages/page-home.js';
import './pages/page-events.js';
import './pages/page-event-detail.js';
import './pages/page-checkout.js';
import './pages/page-my-tickets.js';
import './pages/page-auth.js';
import './pages/page-venue-dashboard.js';
import './pages/page-venue-new-event.js';
import './pages/page-scanner.js';
import './pages/page-oauth-callback.js';
import './pages/page-admin-invites.js';
import './pages/page-invite-accept.js';
import './components/tp-nav.js';

interface Route {
  pattern: RegExp;
  render: (matches: RegExpMatchArray) => unknown;
}

@customElement('tp-app')
export class TpApp extends LitElement {
  static styles = css`
    :host { display: block; min-height: 100vh; }
    main { min-height: calc(100vh - 60px); }
    footer {
      border-top: 1px solid #2e2e3e;
      padding: 1.5rem 2rem;
      text-align: center;
      color: #8888a8;
      font-size: 0.85rem;
    }
    .not-found { text-align: center; padding: 8rem 2rem; }
    .not-found h1 { font-size: 4rem; margin-bottom: 1rem; }
    .not-found p { color: #8888a8; }
  `;

  @state() private _path = window.location.pathname;

  private _routes: Route[] = [
    { pattern: /^\/$/, render: () => html`<page-home></page-home>` },
    { pattern: /^\/events$/, render: () => html`<page-events></page-events>` },
    { pattern: /^\/events\/([^/]+)$/, render: m => html`<page-event-detail .eventId=${m[1]}></page-event-detail>` },
    { pattern: /^\/checkout\/([0-9a-f-]+)$/, render: m => html`<page-checkout .orderId=${m[1]}></page-checkout>` },
    { pattern: /^\/my-tickets$/, render: () => html`<page-my-tickets></page-my-tickets>` },
    { pattern: /^\/login$/, render: () => html`<page-auth mode="login"></page-auth>` },
    { pattern: /^\/register$/, render: () => html`<page-auth mode="register"></page-auth>` },
    { pattern: /^\/auth\/callback$/, render: () => html`<page-oauth-callback></page-oauth-callback>` },
    { pattern: /^\/admin\/invites$/, render: () => html`<page-admin-invites></page-admin-invites>` },
    { pattern: /^\/invite\/([^/]+)$/, render: m => html`<page-invite-accept .token=${m[1]}></page-invite-accept>` },
    { pattern: /^\/venue(\/)?$/, render: () => html`<page-venue-dashboard></page-venue-dashboard>` },
    { pattern: /^\/venue\/events\/new$/, render: () => html`<page-venue-new-event></page-venue-new-event>` },
    { pattern: /^\/scan$/, render: () => html`<page-scanner></page-scanner>` },
  ];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this._onNav);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this._onNav);
  }
  private _onNav = () => { this._path = window.location.pathname; };

  private _resolve() {
    for (const route of this._routes) {
      const m = this._path.match(route.pattern);
      if (m) return route.render(m);
    }
    return html`
      <div class="not-found">
        <h1>404</h1>
        <p>Page not found.</p>
      </div>
    `;
  }

  render() {
    return html`
      <tp-nav></tp-nav>
      <main>${this._resolve()}</main>
      <footer>© 2025 Austin Tickets · Low fees · Local first · Built in ATX 🤠</footer>
    `;
  }
}
