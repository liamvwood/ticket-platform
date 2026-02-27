import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

@customElement('page-oauth-callback')
export class PageOAuthCallback extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      flex-direction: column;
      gap: 1rem;
      color: #8888a8;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #2e2e3e;
      border-top-color: #6c63ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error {
      background: #450a0a; border: 1px solid #7f1d1d;
      border-radius: 8px; padding: 1rem 1.5rem;
      color: #fca5a5; max-width: 400px; text-align: center;
    }
  `;

  @state() error = '';

  async connectedCallback() {
    super.connectedCallback();
    await this._handleCallback();
  }

  private async _handleCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const errorParam = params.get('error');

    if (errorParam) {
      this.error = `OAuth error: ${errorParam}`;
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    if (!code) {
      navigate('/login');
      return;
    }

    const storedState = sessionStorage.getItem('oauth_state');
    const verifier = sessionStorage.getItem('oauth_verifier');
    const provider = sessionStorage.getItem('oauth_provider') ?? 'Google';

    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_verifier');
    sessionStorage.removeItem('oauth_provider');

    if (returnedState && storedState && returnedState !== storedState) {
      this.error = 'State mismatch — possible CSRF. Please try again.';
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    try {
      const redirectUri = `${location.origin}/auth/callback`;
      const res = await api.oauthCallback(provider, code, redirectUri, verifier ?? undefined);
      auth.save(res.token, res.email, res.role);
      navigate('/events');
    } catch (err: any) {
      this.error = err.message || 'Login failed. Please try again.';
      setTimeout(() => navigate('/login'), 3000);
    }
  }

  render() {
    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }
    return html`
      <div class="spinner"></div>
      <span>Completing sign-in…</span>
    `;
  }
}
