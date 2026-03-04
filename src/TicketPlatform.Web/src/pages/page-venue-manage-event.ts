import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { api } from '../services/api.js';
import { auth, navigate } from '../services/auth.js';

@customElement('page-venue-manage-event')
export class PageVenueManageEvent extends LitElement {
  static styles = css`
    :host { display: block; max-width: 700px; margin: 0 auto; padding: 2rem 1rem; font-family: 'Inter', sans-serif; color: #F5F5F5; }
    .back { color: #00FF88; cursor: pointer; font-size: .9rem; margin-bottom: 1.5rem; display: inline-block; }
    .admin-bar { background: linear-gradient(90deg, #1a0a00, #2d1300); border: 1px solid #FF5A1F44; border-radius: 8px; padding: .6rem 1rem; margin-bottom: 1.5rem; font-size: .8rem; color: #FF5A1F; font-weight: 700; display: flex; align-items: center; gap: .5rem; }
    .admin-bar-dot { width: 6px; height: 6px; background: #FF5A1F; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    h1 { font-size: 1.8rem; margin: 0 0 .25rem; }
    .subtitle { color: #6b7a8d; font-size: .9rem; margin-bottom: 2rem; }
    .card { background: #111820; border: 1px solid #1e2836; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    h2 { margin: 0 0 1.2rem; font-size: 1.1rem; color: #F5F5F5; }
    .field { margin-bottom: 1rem; }
    .field label { display: block; font-size: .8rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: .4rem; }
    .field input, .field textarea, .field select { width: 100%; box-sizing: border-box; background: #0B0F14; border: 1px solid #1e2836; border-radius: 8px; padding: .65rem .9rem; color: #F5F5F5; font-size: .95rem; font-family: inherit; }
    .field textarea { min-height: 90px; resize: vertical; }
    .field select option { background: #0B0F14; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 600px) { .row { grid-template-columns: 1fr; } }
    .btn { background: #00FF88; color: #0B0F14; border: none; border-radius: 8px; padding: .75rem 1.5rem; font-weight: 700; cursor: pointer; font-size: .9rem; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secondary { background: #1e2836; color: #F5F5F5; border: 1px solid #2e3a4a; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-ghost { background: transparent; color: #00FF88; border: 1px solid #00FF88; border-radius: 8px; padding: .65rem 1.2rem; cursor: pointer; font-size: .85rem; }
    .error { background: #2d0a0a; border: 1px solid #dc2626; border-radius: 8px; padding: .75rem 1rem; margin-bottom: 1rem; color: #f87171; font-size: .9rem; }
    .success { background: #0a2d12; border: 1px solid #00FF88; border-radius: 8px; padding: .75rem 1rem; margin-bottom: 1rem; color: #00FF88; font-size: .9rem; }
    .status-badge { display: inline-block; padding: .25rem .75rem; border-radius: 999px; font-size: .75rem; font-weight: 700; }
    .status-published { background: #14532d; color: #22c55e; }
    .status-draft { background: #1e1e2e; color: #6b7a8d; }
    .tt-list { display: flex; flex-direction: column; gap: .75rem; }
    .tt-item { background: #0B0F14; border: 1px solid #1e2836; border-radius: 8px; padding: .75rem 1rem; display: flex; align-items: center; gap: .75rem; }
    .tt-info { flex: 1; }
    .tt-name { font-weight: 600; font-size: .95rem; }
    .tt-meta { color: #6b7a8d; font-size: .8rem; margin-top: .15rem; }
    .tt-price { font-weight: 700; color: #00FF88; white-space: nowrap; }
    .tt-remove { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 1rem; padding: .25rem; }
    .actions { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: .5rem; }
  `;

  @property() eventId = '';
  @state() ev: any = null;
  @state() loading = false;
  @state() error = '';
  @state() success = '';
  // Edit fields
  @state() editName = '';
  @state() editDescription = '';
  @state() editStartsAt = '';
  @state() editEndsAt = '';
  @state() editEventType = '';
  // New ticket type
  @state() ttName = 'General Admission';
  @state() ttPrice = '';
  @state() ttQty = '';
  @state() ttMax = '4';
  @state() ttLoading = false;
  // Thumbnail
  @state() thumbnailFile: File | null = null;
  @state() thumbnailPreview = '';

  async connectedCallback() {
    super.connectedCallback();
    if (!auth.isLoggedIn || (auth.role !== 'VenueAdmin' && auth.role !== 'AppOwner')) {
      navigate('/login'); return;
    }
    await this._load();
  }

  private async _load() {
    this.loading = true; this.error = '';
    try {
      this.ev = await api.getEvent(this.eventId);
      this.editName = this.ev.name ?? '';
      this.editDescription = this.ev.description ?? '';
      this.editStartsAt = this.ev.startsAt ? new Date(this.ev.startsAt).toISOString().slice(0, 16) : '';
      this.editEndsAt = this.ev.endsAt ? new Date(this.ev.endsAt).toISOString().slice(0, 16) : '';
      this.editEventType = this.ev.eventType ?? 'other';
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _saveDetails(e: Event) {
    e.preventDefault();
    this.loading = true; this.error = ''; this.success = '';
    try {
      this.ev = await api.updateEvent(this.eventId, {
        name: this.editName,
        description: this.editDescription,
        startsAt: this.editStartsAt ? new Date(this.editStartsAt).toISOString() : undefined,
        endsAt: this.editEndsAt ? new Date(this.editEndsAt).toISOString() : undefined,
        eventType: this.editEventType,
      });
      this.success = 'Event details saved.';
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _togglePublish() {
    this.loading = true; this.error = ''; this.success = '';
    try {
      if (this.ev.isPublished) {
        await api.unpublishEvent(this.eventId);
        this.ev = { ...this.ev, isPublished: false };
        this.success = 'Event unpublished.';
      } else {
        await api.publishEvent(this.eventId);
        this.ev = { ...this.ev, isPublished: true };
        this.success = 'Event published.';
      }
    } catch (err: any) { this.error = err.message; }
    finally { this.loading = false; }
  }

  private async _addTicketType(e: Event) {
    e.preventDefault();
    this.ttLoading = true; this.error = ''; this.success = '';
    try {
      const tt = await api.createTicketType(this.eventId, {
        name: this.ttName, price: parseFloat(this.ttPrice),
        totalQuantity: parseInt(this.ttQty), maxPerOrder: parseInt(this.ttMax),
      });
      this.ev = { ...this.ev, ticketTypes: [...(this.ev.ticketTypes ?? []), tt] };
      this.ttName = 'General Admission'; this.ttPrice = ''; this.ttQty = ''; this.ttMax = '4';
      this.success = 'Ticket type added.';
    } catch (err: any) { this.error = err.message; }
    finally { this.ttLoading = false; }
  }

  private async _removeTicketType(id: string) {
    this.ttLoading = true; this.error = ''; this.success = '';
    try {
      await api.deleteTicketType(this.eventId, id);
      this.ev = { ...this.ev, ticketTypes: this.ev.ticketTypes.filter((t: any) => t.id !== id) };
    } catch (err: any) { this.error = err.message; }
    finally { this.ttLoading = false; }
  }

  private _onThumbnailPick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.thumbnailFile = file;
    const reader = new FileReader();
    reader.onload = () => { this.thumbnailPreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  private async _uploadThumbnail() {
    if (!this.thumbnailFile) return;
    this.loading = true; this.error = ''; this.success = '';
    try {
      const res = await api.uploadEventThumbnail(this.eventId, this.thumbnailFile);
      this.ev = { ...this.ev, thumbnailUrl: res?.thumbnailUrl ?? this.thumbnailPreview };
      this.thumbnailFile = null;
      this.success = 'Thumbnail uploaded.';
    } catch (err: any) { this.error = `Thumbnail upload failed: ${err.message}`; }
    finally { this.loading = false; }
  }

  render() {
    if (this.loading && !this.ev) return html`<div class="back" @click=${() => navigate('/venue')}>← Back to Portal</div><p>Loading…</p>`;
    if (this.error && !this.ev) return html`<div class="back" @click=${() => navigate('/venue')}>← Back to Portal</div><div class="error">${this.error}</div>`;
    if (!this.ev) return html``;

    const tts: any[] = this.ev.ticketTypes ?? [];
    return html`
      <div class="back" @click=${() => navigate('/venue')}>← Back to Portal</div>
      <div class="admin-bar"><div class="admin-bar-dot"></div>⚙ Admin Area — Manage Event</div>
      <h1>${this.ev.name}</h1>
      <p class="subtitle">
        <span class="status-badge ${this.ev.isPublished ? 'status-published' : 'status-draft'}">
          ${this.ev.isPublished ? '● Published' : '○ Draft'}
        </span>
      </p>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      ${this.success ? html`<div class="success">${this.success}</div>` : ''}

      <!-- Event Details -->
      <form @submit=${this._saveDetails}>
        <div class="card">
          <h2>Event Details</h2>
          <div class="field">
            <label>Event Name</label>
            <input type="text" .value=${this.editName} @input=${(e: any) => this.editName = e.target.value} required />
          </div>
          <div class="field">
            <label>Description</label>
            <textarea .value=${this.editDescription} @input=${(e: any) => this.editDescription = e.target.value}></textarea>
          </div>
          <div class="field">
            <label>Event Type</label>
            <select .value=${this.editEventType} @change=${(e: any) => this.editEventType = e.target.value}>
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
              <input type="datetime-local" .value=${this.editStartsAt} @input=${(e: any) => this.editStartsAt = e.target.value} />
            </div>
            <div class="field">
              <label>Ends At</label>
              <input type="datetime-local" .value=${this.editEndsAt} @input=${(e: any) => this.editEndsAt = e.target.value} />
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="btn" type="submit" ?disabled=${this.loading}>Save Changes</button>
          <button class="btn ${this.ev.isPublished ? 'btn-danger' : ''} btn-secondary" type="button"
            ?disabled=${this.loading} @click=${this._togglePublish}>
            ${this.ev.isPublished ? 'Unpublish' : '✓ Publish Event'}
          </button>
        </div>
      </form>

      <!-- Thumbnail -->
      <div class="card">
        <h2>Event Thumbnail</h2>
        ${this.ev.thumbnailUrl ? html`
          <img src=${this.ev.thumbnailUrl} style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-bottom:1rem" />
        ` : html`<p style="color:#6b7a8d;font-size:.85rem;margin-bottom:1rem">No thumbnail set.</p>`}
        ${this.thumbnailPreview ? html`
          <img src=${this.thumbnailPreview} style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:.75rem;border:2px dashed #00FF88" />
        ` : ''}
        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
          <label style="display:inline-block;background:#1e1e2e;border:1px dashed #3e3e5e;border-radius:8px;padding:.65rem 1rem;cursor:pointer;font-size:.9rem;color:#00FF88">
            ${this.thumbnailFile ? `📷 ${this.thumbnailFile.name}` : '📷 Choose image…'}
            <input type="file" accept="image/*" style="display:none" @change=${this._onThumbnailPick} />
          </label>
          ${this.thumbnailFile ? html`
            <button class="btn" type="button" ?disabled=${this.loading} @click=${this._uploadThumbnail}>
              ${this.loading ? 'Uploading…' : 'Upload'}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Ticket Types -->
      <div class="card">
        <h2>Ticket Types</h2>
        ${tts.length > 0 ? html`
          <div class="tt-list" style="margin-bottom:1.5rem">
            ${tts.map(tt => html`
              <div class="tt-item">
                <div class="tt-info">
                  <div class="tt-name">${tt.name}</div>
                  <div class="tt-meta">${tt.totalQuantity} total · max ${tt.maxPerOrder}/order</div>
                </div>
                <div class="tt-price">$${(tt.price ?? 0).toFixed(2)}</div>
                <button class="tt-remove" type="button" title="Remove" ?disabled=${this.ttLoading}
                  @click=${() => this._removeTicketType(tt.id)}>✕</button>
              </div>
            `)}
          </div>
        ` : html`<p style="color:#6b7a8d;font-size:.85rem;margin-bottom:1rem">No ticket types yet.</p>`}
        <form @submit=${this._addTicketType}>
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
          <button class="btn" type="submit" ?disabled=${this.ttLoading}>
            ${this.ttLoading ? 'Adding…' : '+ Add Ticket Type'}
          </button>
        </form>
      </div>
    `;
  }
}
