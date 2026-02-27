import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { navigate } from '../services/auth.js';

@customElement('page-venue-new-event')
export class PageVenueNewEvent extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 680px; margin: 0 auto; }
    .back { color: #8888a8; cursor: pointer; font-size: 0.9rem; margin-bottom: 2rem; display: inline-flex; align-items: center; gap: .4rem; }
    .back:hover { color: #fff; }
    h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 2rem; }
    .card { background: #1a1a24; border: 1px solid #2e2e3e; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1rem; font-weight: 700; color: #818cf8; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: .05em; }
    .field { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #ccc; margin-bottom: .4rem; }
    input, textarea { width: 100%; background: #22222f; border: 1px solid #2e2e3e; color: #f0f0f8; border-radius: 8px; padding: .7rem 1rem; font-size: .95rem; box-sizing: border-box; font-family: inherit; transition: border-color .2s; }
    input:focus, textarea:focus { outline: none; border-color: #6c63ff; }
    textarea { resize: vertical; min-height: 80px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .btn {
      background: #6c63ff; color: #fff; padding: .8rem 2rem;
      border-radius: 10px; font-weight: 700; font-size: 1rem;
      cursor: pointer; border: none; font-family: inherit; transition: background .2s;
    }
    .btn:hover:not(:disabled) { background: #5a52e0; }
    .btn:disabled { opacity: .4; cursor: not-allowed; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: .75rem 1rem; color: #fca5a5; margin-bottom: 1rem; }
    .tt-added { background: #14532d; border: 1px solid #166534; border-radius: 8px; padding: .75rem 1rem; color: #86efac; margin-bottom: 1rem; }
    .step-indicator { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .step { padding: .4rem 1rem; border-radius: 999px; font-size: .8rem; font-weight: 600; }
    .step.active { background: #1e1b4b; color: #818cf8; border: 1px solid #3730a3; }
    .step.done { background: #14532d; color: #22c55e; }
    .step.inactive { background: #1e1e2e; color: #8888a8; }
  `;

  @state() step: 'event' | 'tickets' = 'event';
  @state() createdEventId = '';
  @state() loading = false;
  @state() error = '';
  @state() ttAdded = 0;

  // Event fields
  @state() name = '';
  @state() description = '';
  @state() startsAt = '';
  @state() endsAt = '';
  @state() saleStartsAt = '';
  @state() venueId = '00000000-0000-0000-0000-000000000001'; // placeholder

  // Ticket type fields
  @state() ttName = 'General Admission';
  @state() ttPrice = '25.00';
  @state() ttQty = '200';
  @state() ttMax = '4';

  private async _createEvent(e: Event) {
    e.preventDefault();
    this.loading = true; this.error = '';
    try {
      const ev = await api.createEvent({
        venueId: this.venueId,
        name: this.name,
        description: this.description,
        startsAt: new Date(this.startsAt).toISOString(),
        endsAt: new Date(this.endsAt).toISOString(),
        saleStartsAt: new Date(this.saleStartsAt).toISOString(),
      });
      this.createdEventId = ev.id;
      this.step = 'tickets';
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _addTicketType(e: Event) {
    e.preventDefault();
    this.loading = true; this.error = '';
    try {
      await api.createTicketType(this.createdEventId, {
        name: this.ttName, price: parseFloat(this.ttPrice),
        totalQuantity: parseInt(this.ttQty), maxPerOrder: parseInt(this.ttMax),
      });
      this.ttAdded++;
      this.ttName = ''; this.ttPrice = ''; this.ttQty = ''; this.ttMax = '4';
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _publish() {
    this.loading = true;
    try {
      await api.publishEvent(this.createdEventId);
      navigate('/venue');
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  render() {
    return html`
      <div class="back" @click=${() => navigate('/venue')}>← Back to Portal</div>
      <h1>Create New Event</h1>

      <div class="step-indicator">
        <div class="step ${this.step === 'event' ? 'active' : 'done'}">1 · Event Details</div>
        <div class="step ${this.step === 'tickets' ? 'active' : 'inactive'}">2 · Ticket Types</div>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}

      ${this.step === 'event' ? html`
        <form @submit=${this._createEvent}>
          <div class="card">
            <h2>Event Details</h2>
            <div class="field">
              <label>Event Name</label>
              <input type="text" .value=${this.name} @input=${(e: any) => this.name = e.target.value} required placeholder="Live at Stubb's" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea .value=${this.description} @input=${(e: any) => this.description = e.target.value} placeholder="Describe the event…"></textarea>
            </div>
            <div class="row">
              <div class="field">
                <label>Starts At</label>
                <input type="datetime-local" .value=${this.startsAt} @input=${(e: any) => this.startsAt = e.target.value} required />
              </div>
              <div class="field">
                <label>Ends At</label>
                <input type="datetime-local" .value=${this.endsAt} @input=${(e: any) => this.endsAt = e.target.value} required />
              </div>
            </div>
            <div class="field">
              <label>Sale Starts At</label>
              <input type="datetime-local" .value=${this.saleStartsAt} @input=${(e: any) => this.saleStartsAt = e.target.value} required />
            </div>
          </div>
          <button class="btn" type="submit" ?disabled=${this.loading}>
            ${this.loading ? 'Creating…' : 'Continue →'}
          </button>
        </form>
      ` : html`
        ${this.ttAdded > 0 ? html`<div class="tt-added">✓ ${this.ttAdded} ticket type${this.ttAdded > 1 ? 's' : ''} added</div>` : ''}
        <form @submit=${this._addTicketType}>
          <div class="card">
            <h2>Add Ticket Type</h2>
            <div class="field">
              <label>Name</label>
              <input type="text" .value=${this.ttName} @input=${(e: any) => this.ttName = e.target.value} required placeholder="General Admission" />
            </div>
            <div class="row">
              <div class="field">
                <label>Price ($)</label>
                <input type="number" step="0.01" min="0" .value=${this.ttPrice} @input=${(e: any) => this.ttPrice = e.target.value} required placeholder="25.00" />
              </div>
              <div class="field">
                <label>Total Quantity</label>
                <input type="number" min="1" .value=${this.ttQty} @input=${(e: any) => this.ttQty = e.target.value} required placeholder="200" />
              </div>
            </div>
            <div class="field">
              <label>Max Per Order</label>
              <input type="number" min="1" max="20" .value=${this.ttMax} @input=${(e: any) => this.ttMax = e.target.value} required placeholder="4" />
            </div>
          </div>
          <div style="display:flex;gap:1rem;flex-wrap:wrap">
            <button class="btn" type="submit" ?disabled=${this.loading}>
              ${this.loading ? 'Adding…' : '+ Add Ticket Type'}
            </button>
            ${this.ttAdded > 0 ? html`
              <button class="btn" type="button" style="background:#22c55e" ?disabled=${this.loading} @click=${this._publish}>
                ${this.loading ? '…' : '✓ Publish Event'}
              </button>
            ` : ''}
          </div>
        </form>
      `}
    `;
  }
}
