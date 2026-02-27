import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

// PKCE helpers
function generateCodeVerifier(): string {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const PROVIDER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  Google: {
    label: 'Continue with Google',
    color: '#4285F4',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.1 0-9.5-3.2-11.3-7.8l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2C36.9 35.3 44 29.3 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>`,
  },
  GitHub: {
    label: 'Continue with GitHub',
    color: '#24292e',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg>`,
  },
  Facebook: {
    label: 'Continue with Facebook',
    color: '#1877F2',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/></svg>`,
  },
};

@customElement('page-auth')
export class PageAuth extends LitElement {
  static styles = css`
    :host { display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 2rem; }
    .box {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
    }
    .logo { text-align: center; margin-bottom: 0.5rem; color: #6c63ff; display: flex; justify-content: center; }
    h1 { text-align: center; font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem; }
    .sub { text-align: center; color: #8888a8; font-size: 0.9rem; margin-bottom: 2rem; }
    .field { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; color: #ccc; }
    input { width: 100%; background: #22222f; border: 1px solid #2e2e3e; color: #f0f0f8; border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.95rem; transition: border-color 0.2s; box-sizing: border-box; font-family: inherit; }
    input:focus { outline: none; border-color: #6c63ff; }
    .btn {
      width: 100%;
      background: #6c63ff;
      color: #fff;
      padding: 0.8rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: background 0.2s;
      margin-top: 0.5rem;
    }
    .btn:hover:not(:disabled) { background: #5a52e0; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 0.75rem 1rem; color: #fca5a5; font-size: 0.9rem; margin-bottom: 1rem; }
    .switch { text-align: center; margin-top: 1.5rem; font-size: 0.9rem; color: #8888a8; }
    .switch a { color: #818cf8; cursor: pointer; }
    .switch a:hover { color: #a5b4fc; }
    .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0; color: #555570; font-size: 0.82rem; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #2e2e3e; }
    .oauth-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 1rem;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-family: inherit;
      color: #fff;
      margin-bottom: 0.65rem;
      transition: filter 0.15s;
    }
    .oauth-btn:hover { filter: brightness(1.1); }
    .oauth-btn:last-of-type { margin-bottom: 0; }
    .oauth-icon { display: flex; align-items: center; flex-shrink: 0; }
  `;

  @property() mode: 'login' | 'register' = 'login';
  @state() email = '';
  @state() password = '';
  @state() phone = '';
  @state() loading = false;
  @state() error = '';

  private async _submit(e: Event) {
    e.preventDefault();
    this.loading = true;
    this.error = '';
    try {
      const res = this.mode === 'login'
        ? await api.login(this.email, this.password)
        : await api.register(this.email, this.password, this.phone);
      auth.save(res.token, res.email, res.role);
      navigate('/events');
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  private async _oauthLogin(provider: string) {
    this.loading = true;
    this.error = '';
    try {
      // In mock/dev mode, the mock endpoint returns 200; in prod it returns 404.
      const mockRes = await fetch(`/api/auth/oauth/mock-login?provider=${encodeURIComponent(provider)}&email=test%40example.com`);
      if (mockRes.ok) {
        const data = await mockRes.json();
        auth.save(data.token, data.email, data.role);
        navigate('/events');
        return;
      }

      // Production: initiate PKCE Authorization Code Flow
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = crypto.randomUUID();
      const redirectUri = `${location.origin}/auth/callback`;

      sessionStorage.setItem('oauth_verifier', verifier);
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_provider', provider);

      const authUrl = `/api/auth/oauth/authorize?provider=${encodeURIComponent(provider)}&redirectUri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&codeChallenge=${encodeURIComponent(challenge)}`;
      // Follow the redirect — the API will 302 to the actual OAuth provider
      location.href = authUrl;
    } catch (err: any) {
      this.error = err.message || 'OAuth login failed.';
      this.loading = false;
    }
  }

  render() {
    const isLogin = this.mode === 'login';
    return html`
      <div class="box">
        <div class="logo" .innerHTML=${icons.ticket}></div>
        <h1>${isLogin ? 'Welcome back' : 'Create account'}</h1>
        <p class="sub">${isLogin ? 'Log in to access your tickets.' : 'Join Austin Tickets — no bots allowed.'}</p>
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        ${Object.entries(PROVIDER_CONFIG).map(([provider, cfg]) => html`
          <button
            class="oauth-btn"
            style="background:${cfg.color}"
            ?disabled=${this.loading}
            @click=${() => this._oauthLogin(provider)}>
            <span class="oauth-icon" .innerHTML=${cfg.icon}></span>
            ${cfg.label}
          </button>
        `)}

        <div class="divider">or continue with email</div>

        <form @submit=${this._submit}>
          <div class="field">
            <label>Email</label>
            <input type="email" .value=${this.email} @input=${(e: any) => this.email = e.target.value} required placeholder="you@example.com" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" .value=${this.password} @input=${(e: any) => this.password = e.target.value} required placeholder="••••••••" minlength="8" />
          </div>
          ${!isLogin ? html`
            <div class="field">
              <label>Phone Number</label>
              <input type="tel" .value=${this.phone} @input=${(e: any) => this.phone = e.target.value} placeholder="+1 (512) 555-0100" />
            </div>
          ` : ''}
          <button class="btn" type="submit" ?disabled=${this.loading}>
            ${this.loading ? 'Please wait…' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>
        <div class="switch">
          ${isLogin
            ? html`No account? <a @click=${() => navigate('/register')}>Sign up free</a>`
            : html`Already have an account? <a @click=${() => navigate('/login')}>Log in</a>`}
        </div>
      </div>
    `;
  }
}
