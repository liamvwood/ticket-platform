import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';
import { icons } from '../services/icons.js';

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

  render() {
    const isLogin = this.mode === 'login';
    return html`
      <div class="box">
        <div class="logo" .innerHTML=${icons.ticket}></div>
        <h1>${isLogin ? 'Welcome back' : 'Create account'}</h1>
        <p class="sub">${isLogin ? 'Log in to access your tickets.' : 'Join Austin Tickets — no bots allowed.'}</p>
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
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
