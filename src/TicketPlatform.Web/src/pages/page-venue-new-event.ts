import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

@customElement('page-venue-new-event')
export class PageVenueNewEvent extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 680px; margin: 0 auto; }
    .back { color: #6b7a8d; cursor: pointer; font-size: 0.9rem; margin-bottom: 2rem; display: inline-flex; align-items: center; gap: .4rem; }
    .back:hover { color: #fff; }
    h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 2rem; }
    .admin-bar {
      background: linear-gradient(90deg, #FF5A1F22, #FF5A1F11);
      border: 1px solid #FF5A1F55; border-radius: 10px;
      padding: 0.6rem 1.2rem; display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 2rem; font-size: 0.85rem; color: #FF5A1F; font-weight: 600;
    }
    .admin-bar-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF5A1F; flex-shrink: 0; }
    .card { background: #111820; border: 1px solid #1e2836; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1rem; font-weight: 700; color: #00FF88; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: .05em; }
    .field { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #ccc; margin-bottom: .4rem; }
    input, textarea, select { width: 100%; background: #0d1319; border: 1px solid #1e2836; color: #f0f0f8; border-radius: 8px; padding: .7rem 1rem; font-size: .95rem; box-sizing: border-box; font-family: inherit; transition: border-color .2s; }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #00FF88; }
    textarea { resize: vertical; min-height: 80px; }
    select option { background: #0d1319; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .btn {
      background: #00FF88; color: #0b0f14; padding: .8rem 2rem;
      border-radius: 10px; font-weight: 700; font-size: 1rem;
      cursor: pointer; border: none; font-family: inherit; transition: background .2s;
    }
    .btn:hover:not(:disabled) { background: #00d474; }
    .btn:disabled { opacity: .4; cursor: not-allowed; }
    .btn-ghost {
      background: transparent; border: 1px solid #1e2836; color: #ccc;
      padding: .8rem 2rem; border-radius: 10px; font-weight: 600; font-size: 1rem;
      cursor: pointer; font-family: inherit; transition: all .2s;
    }
    .btn-ghost:hover { border-color: #555; color: #fff; }
    .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: .75rem 1rem; color: #fca5a5; margin-bottom: 1rem; }
    .tt-added { background: #14532d; border: 1px solid #166534; border-radius: 8px; padding: .75rem 1rem; color: #86efac; margin-bottom: 1rem; }
    /* Ticket type list */
    .tt-list { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1.5rem; }
    .tt-item {
      background: #0b0f14; border: 1px solid #1e2836; border-radius: 10px;
      padding: 1rem 1.25rem; display: flex; align-items: center;
      justify-content: space-between; gap: 1rem;
    }
    .tt-item-info { flex: 1; min-width: 0; }
    .tt-item-name { font-weight: 700; font-size: .95rem; margin-bottom: .2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tt-item-meta { font-size: .8rem; color: #6b7a8d; }
    .tt-item-price { font-size: 1.1rem; font-weight: 800; color: #22c55e; white-space: nowrap; }
    .tt-remove { background: none; border: none; color: #555568; cursor: pointer; padding: .25rem; border-radius: 4px; line-height: 1; font-size: 1.1rem; }
    .tt-remove:hover { color: #ef4444; background: #1e0a0a; }
    .tt-edit { background: none; border: none; color: #555568; cursor: pointer; padding: .25rem; border-radius: 4px; line-height: 1; font-size: 1.1rem; }
    .tt-edit:hover { color: #00FF88; background: #1e1e3e; }
    .tt-item-editing { border-color: #00FF88; background: #1a1a30; }
    .step-indicator { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .step { padding: .4rem 1rem; border-radius: 999px; font-size: .8rem; font-weight: 600; }
    .step.active { background: #0d1a15; color: #00FF88; border: 1px solid #1e2836; }
    .step.done { background: #14532d; color: #22c55e; }
    .step.inactive { background: #1e1e2e; color: #6b7a8d; }
    @media (max-width: 640px) {
      :host { padding: 1rem; }
      .row { grid-template-columns: 1fr; }
    }
  `;

  @state() step: 'event' | 'tickets' = 'event';
  @state() createdEventId = '';
  @state() loading = false;
  @state() error = '';
  @state() ttAdded = 0;
  @state() ticketTypes: Array<{id: string; name: string; price: number; totalQuantity: number; maxPerOrder: number}> = [];
  @state() thumbnailFile: File | null = null;
  @state() thumbnailPreview = '';
  @state() venues: any[] = [];
  @state() showNewVenue = false;
  @state() newVenueName = '';
  @state() newVenueAddress = '';
  @state() newVenueCity = 'Austin';
  @state() newVenueState = 'TX';

  // Event fields
  @state() name = '';
  @state() description = '';
  @state() startsAt = '';
  @state() endsAt = '';
  @state() saleStartsAt = '';
  @state() recurringRule = '';
  @state() venueId = '';
  @state() eventType = 'other';

  // Ticket type fields
  @state() ttName = 'General Admission';
  @state() ttPrice = '25.00';
  @state() ttQty = '200';
  @state() ttMax = '4';
  @state() editingTtId = ''; // when set, "Add" becomes "Update"

  async connectedCallback() {
    super.connectedCallback();
    if (auth.role === 'AppOwner') {
      try {
        this.venues = await api.getVenues();
        if (this.venues.length > 0) this.venueId = this.venues[0].id;
      } catch {}
    } else {
      // VenueAdmin: use the seeded/default venue
      this.venueId = '00000000-0000-0000-0000-000000000001';
    }
  }

  private async _createVenue(e?: Event) {
    if (e) e.preventDefault();
    if (!this.newVenueName.trim()) { this.error = 'Venue name is required.'; return; }
    this.loading = true; this.error = '';
    try {
      const v = await api.createVenue({
        name: this.newVenueName, address: this.newVenueAddress,
        city: this.newVenueCity, state: this.newVenueState,
      });
      this.venues = [...this.venues, v];
      this.venueId = v.id;
      this.showNewVenue = false;
      this.newVenueName = ''; this.newVenueAddress = '';
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _createEvent(e: Event) {
    e.preventDefault();
    if (!this.venueId) { this.error = 'Please select a venue.'; return; }
    this.loading = true; this.error = '';
    try {
      const ev = await api.createEvent({
        venueId: this.venueId,
        name: this.name,
        description: this.description,
        startsAt: new Date(this.startsAt).toISOString(),
        endsAt: new Date(this.endsAt).toISOString(),
        saleStartsAt: new Date(this.saleStartsAt).toISOString(),
        recurringRule: this.recurringRule || undefined,
        eventType: this.eventType,
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
      if (this.editingTtId) {
        // Delete existing and recreate with updated values
        await api.deleteTicketType(this.createdEventId, this.editingTtId);
        this.ticketTypes = this.ticketTypes.filter(t => t.id !== this.editingTtId);
      }
      const tt = await api.createTicketType(this.createdEventId, {
        name: this.ttName, price: parseFloat(this.ttPrice),
        totalQuantity: parseInt(this.ttQty), maxPerOrder: parseInt(this.ttMax),
      });
      this.ticketTypes = [...this.ticketTypes, tt];
      this.ttAdded = this.ticketTypes.length;
      this.editingTtId = '';
      this.ttName = 'General Admission'; this.ttPrice = ''; this.ttQty = ''; this.ttMax = '4';
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private _editTicketType(tt: {id: string; name: string; price: number; totalQuantity: number; maxPerOrder: number}) {
    this.editingTtId = tt.id;
    this.ttName = tt.name;
    this.ttPrice = tt.price.toFixed(2);
    this.ttQty = String(tt.totalQuantity);
    this.ttMax = String(tt.maxPerOrder);
  }

  private async _removeTicketType(id: string) {
    if (this.editingTtId === id) { this.editingTtId = ''; }
    this.loading = true; this.error = '';
    try {
      await api.deleteTicketType(this.createdEventId, id);
      this.ticketTypes = this.ticketTypes.filter(t => t.id !== id);
      this.ttAdded = this.ticketTypes.length;
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _publish() {
    this.loading = true;
    try {
      // Upload thumbnail via presigned S3 PUT if selected
      if (this.thumbnailFile) {
        try {
          const { uploadUrl } = await api.getEventImageUploadUrl(this.createdEventId);
          await fetch(uploadUrl, {
            method: 'PUT',
            body: this.thumbnailFile,
            headers: { 'Content-Type': 'image/jpeg' },
          });
        } catch (err: any) { this.error = `Thumbnail upload failed: ${err.message}. Event not published.`; this.loading = false; return; }
      }
      await api.publishEvent(this.createdEventId);
      navigate('/venue');
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private _onThumbnailPick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.thumbnailFile = file;
    const reader = new FileReader();
    reader.onload = () => { this.thumbnailPreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  render() {
    const isOwner = auth.role === 'AppOwner';
    return html`
      <div class="back" @click=${() => navigate('/venue')}>← Back to Portal</div>
      <div class="admin-bar"><div class="admin-bar-dot"></div>⚙ Admin Area — Create New Event</div>
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
              ${isOwner ? html`
              <div class="field">
                <label>Venue</label>
                ${this.showNewVenue ? html`
                  <div style="margin-top:.5rem">
                    <input type="text" placeholder="Venue name *" .value=${this.newVenueName}
                      @input=${(e: any) => this.newVenueName = e.target.value} style="margin-bottom:.5rem" />
                    <input type="text" placeholder="Address" .value=${this.newVenueAddress}
                      @input=${(e: any) => this.newVenueAddress = e.target.value} style="margin-bottom:.5rem" />
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
                      <input type="text" placeholder="City" .value=${this.newVenueCity}
                        @input=${(e: any) => this.newVenueCity = e.target.value} style="flex:1" />
                      <input type="text" placeholder="State" .value=${this.newVenueState} maxlength="2"
                        @input=${(e: any) => this.newVenueState = e.target.value} style="flex:0 0 70px" />
                    </div>
                    <div style="display:flex;gap:.5rem">
                      <button class="btn" type="button" ?disabled=${this.loading} style="flex:1"
                        @click=${this._createVenue}>Save Venue</button>
                      <button class="btn" type="button" style="background:#1e2836;flex:0 0 auto"
                        @click=${() => this.showNewVenue = false}>Cancel</button>
                    </div>
                  </div>
                ` : html`
                  <select .value=${this.venueId} @change=${(e: any) => this.venueId = e.target.value}>
                    ${this.venues.length === 0
                      ? html`<option value="">No venues yet</option>`
                      : this.venues.map(v => html`<option value=${v.id}>${v.name}</option>`)}
                  </select>
                  <div style="margin-top:.5rem">
                    <span style="font-size:.8rem;color:#00FF88;cursor:pointer" @click=${() => this.showNewVenue = true}>
                      + Create new venue
                    </span>
                  </div>
                `}
              </div>
            ` : ''}
            <div class="field">
              <label>Event Name</label>
              <input type="text" .value=${this.name} @input=${(e: any) => this.name = e.target.value} required placeholder="Live at Stubb's" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea .value=${this.description} @input=${(e: any) => this.description = e.target.value} placeholder="Describe the event…"></textarea>
            </div>
            <div class="field">
              <label>Event Type</label>
              <select .value=${this.eventType} @change=${(e: any) => this.eventType = e.target.value}>
                <option value="other">Other</option>
                <option value="comedy">Comedy</option>
                <option value="music">Music</option>
                <option value="sports">Sports</option>
                <option value="arts">Arts</option>
                <option value="food">Food</option>
                <option value="tech">Tech</option>
              </select>
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
            <div class="field">
              <label>Recurrence (optional)</label>
              <select .value=${this.recurringRule} @change=${(e: any) => this.recurringRule = e.target.value}
                style="background:#111820;border:1px solid #1e2836;color:#F5F5F5;padding:0.65rem 0.9rem;border-radius:8px;font-size:0.95rem;font-family:inherit;width:100%">
                <option value="">One-time event</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Biweekly (every 2 weeks)</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <!-- Thumbnail upload on step 1 so it's visible before publish -->
            <div class="field">
              <label>Event Thumbnail <span style="color:#6b7a8d;font-weight:400;font-size:0.85rem">(optional)</span></label>
              <p style="color:#6b7a8d;font-size:0.85rem;margin:0 0 .5rem">Upload a cover image for the event listing.</p>
              ${this.thumbnailPreview ? html`
                <img src=${this.thumbnailPreview} style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:.5rem" />
              ` : ''}
              <label style="display:inline-block;background:#1e1e2e;border:1px dashed #3e3e5e;border-radius:8px;padding:0.65rem 1rem;cursor:pointer;font-size:0.9rem;color:#00FF88">
                ${this.thumbnailFile ? `📷 ${this.thumbnailFile.name}` : '📷 Choose image…'}
                <input type="file" accept="image/*" style="display:none" @change=${this._onThumbnailPick} />
              </label>
            </div>
          </div>
          <button class="btn" type="submit" ?disabled=${this.loading}>
            ${this.loading ? 'Creating…' : 'Continue →'}
          </button>
        </form>
      ` : html`
        ${this.ticketTypes.length > 0 ? html`
          <div class="card">
            <h2>Ticket Types Added</h2>
            <div class="tt-list">
              ${this.ticketTypes.map(tt => html`
                <div class="tt-item ${this.editingTtId === tt.id ? 'tt-item-editing' : ''}">
                  <div class="tt-item-info">
                    <div class="tt-item-name">${tt.name}</div>
                    <div class="tt-item-meta">${tt.totalQuantity} tickets · max ${tt.maxPerOrder}/order</div>
                  </div>
                  <div class="tt-item-price">$${tt.price.toFixed(2)}</div>
                  <button class="tt-edit" title="Edit" ?disabled=${this.loading}
                    @click=${() => this._editTicketType(tt)}>✏️</button>
                  <button class="tt-remove" title="Remove" ?disabled=${this.loading}
                    @click=${() => this._removeTicketType(tt.id)}>✕</button>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
        <form @submit=${this._addTicketType}>
          <div class="card">
            <h2>${this.editingTtId ? 'Edit Ticket Type' : this.ticketTypes.length > 0 ? 'Add Another Ticket Type' : 'Add Ticket Type'}</h2>
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
              ${this.loading ? (this.editingTtId ? 'Updating…' : 'Adding…') : (this.editingTtId ? '✓ Update Ticket Type' : '+ Add Ticket Type')}
            </button>
            ${this.editingTtId ? html`
              <button class="btn-ghost" type="button" @click=${() => { this.editingTtId = ''; this.ttName = 'General Admission'; this.ttPrice = ''; this.ttQty = ''; this.ttMax = '4'; }}>
                Cancel Edit
              </button>
            ` : ''}
            ${this.ticketTypes.length > 0 && !this.editingTtId ? html`
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
