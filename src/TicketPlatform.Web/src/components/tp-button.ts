import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('tp-button')
export class TpButton extends LitElement {
  static styles = css`
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.65rem 1.4rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      width: var(--btn-width, auto);
    }
    .primary { background: #6c63ff; color: #fff; }
    .primary:hover:not(:disabled) { background: #5a52e0; transform: translateY(-1px); }
    .secondary { background: transparent; border: 1px solid #2e2e3e; color: #ccc; }
    .secondary:hover:not(:disabled) { border-color: #555; color: #fff; }
    .danger { background: #ef4444; color: #fff; }
    .danger:hover:not(:disabled) { background: #dc2626; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  @property() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;
  @property() type: string = 'button';

  render() {
    return html`
      <button class=${this.variant} ?disabled=${this.disabled || this.loading} type=${this.type}>
        ${this.loading ? html`<span>⏳</span>` : ''}
        <slot></slot>
      </button>
    `;
  }
}
