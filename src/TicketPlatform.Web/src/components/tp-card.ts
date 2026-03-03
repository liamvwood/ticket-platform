import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('tp-card')
export class TpCard extends LitElement {
  static styles = css`
    :host { display: block; }
    .card {
      background: #111820;
      border: 1px solid #1e2836;
      border-radius: 12px;
      padding: 1.5rem;
      transition: border-color 0.2s, transform 0.2s;
    }
    .card.hoverable:hover {
      border-color: #00FF88;
      transform: translateY(-2px);
      cursor: pointer;
    }
  `;
  @property({ type: Boolean }) hoverable = false;

  render() {
    return html`<div class="card ${this.hoverable ? 'hoverable' : ''}"><slot></slot></div>`;
  }
}
