import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('tp-badge')
export class TpBadge extends LitElement {
  static styles = css`
    span {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .success { background: #14532d; color: #22c55e; }
    .warning { background: #451a03; color: #f59e0b; }
    .danger  { background: #450a0a; color: #ef4444; }
    .info    { background: #0d1a15; color: #00FF88; }
    .muted   { background: #1e1e2e; color: #6b7a8d; }
  `;
  @property() variant: 'success' | 'warning' | 'danger' | 'info' | 'muted' = 'info';

  render() {
    return html`<span class=${this.variant}><slot></slot></span>`;
  }
}
