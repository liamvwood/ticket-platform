const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080';

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('jwt');
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    // Try to extract a human-readable message from JSON error bodies
    try {
      const json = JSON.parse(text);
      const msg = json.error ?? json.title ?? json.message ?? json.detail;
      if (msg && typeof msg === 'string') throw new Error(msg);
      // Re-throw raw JSON so callers can inspect structured fields (e.g. invitePending)
      throw new Error(text);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(`HTTP ${res.status}`);
      throw e;
    }
  }
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : (null as T);
}

// Raw fetch — no Content-Type preset (used for multipart/form-data)
async function requestRaw(path: string, opts: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('jwt');
  const res = await fetch(`${API}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => null);
}

export const api = {
  // Auth
  register: (email: string, password: string, phoneNumber: string) =>
    request<{ token: string; email: string; role: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, phoneNumber }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; email: string; role: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  // Venues
  getVenues: () => request<any[]>('/venues'),
  createVenue: (data: { name: string; address?: string; city?: string; state?: string }) =>
    request<any>('/venues', { method: 'POST', body: JSON.stringify(data) }),

  // Events
  getEvents: (page = 1, pageSize = 12) => request<any>(`/events?page=${page}&pageSize=${pageSize}`),
  getEventsAdmin: (page = 1, pageSize = 20) => request<any>(`/events/admin?page=${page}&pageSize=${pageSize}`),
  getEvent: (id: string) => request<any>(`/events/${id}`),
  uploadEventThumbnail: (eventId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestRaw(`/events/${eventId}/thumbnail`, { method: 'POST', body: form });
  },
  createEvent: (data: any) =>
    request<any>('/events', { method: 'POST', body: JSON.stringify(data) }),
  publishEvent: (id: string) =>
    request<void>(`/events/${id}/publish`, { method: 'PUT' }),
  unpublishEvent: (id: string) =>
    request<void>(`/events/${id}/unpublish`, { method: 'PUT' }),
  createTicketType: (eventId: string, data: any) =>
    request<any>(`/events/${eventId}/ticket-types`, { method: 'POST', body: JSON.stringify(data) }),
  deleteTicketType: (eventId: string, ticketTypeId: string) =>
    request<void>(`/events/${eventId}/ticket-types/${ticketTypeId}`, { method: 'DELETE' }),

  // Orders
  createOrder: (ticketTypeId: string, quantity: number, platformFee = 0, referralCode?: string) => {
    const qs = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : '';
    return request<any>(`/orders${qs}`, { method: 'POST', body: JSON.stringify({ ticketTypeId, quantity, platformFee }) });
  },
  createOrderMulti: (items: { ticketTypeId: string; quantity: number }[], platformFee = 0, referralCode?: string) => {
    const qs = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : '';
    // Use first item as legacy fields for back-compat, plus the new items array
    const first = items[0];
    return request<any>(`/orders${qs}`, {
      method: 'POST',
      body: JSON.stringify({ ticketTypeId: first.ticketTypeId, quantity: first.quantity, platformFee, items }),
    });
  },
  getOrders: () => request<any[]>('/orders'),
  getOrder: (id: string) => request<any>(`/orders/${id}`),

  // Checkout
  createCheckout: (orderId: string) =>
    request<{ clientSecret: string; paymentIntentId: string }>(`/payments/orders/${orderId}/checkout`, { method: 'POST' }),
  mockConfirm: (orderId: string) =>
    request<{ status: string }>(`/payments/orders/${orderId}/mock-confirm`, { method: 'POST' }),

  // Phone OTP (guest checkout)
  requestOtp: (phoneNumber: string) =>
    request<{ message: string; devCode?: string }>('/auth/phone/request-otp', {
      method: 'POST', body: JSON.stringify({ phoneNumber }),
    }),
  verifyOtp: (phoneNumber: string, code: string) =>
    request<{ token: string; email: string; role: string }>('/auth/phone/verify-otp', {
      method: 'POST', body: JSON.stringify({ phoneNumber, code }),
    }),

  // Referrals
  getReferrals: () => request<{ referralCode: string; referralCount: number }>('/users/me/referrals'),

  // OAuth / Social Login
  getOAuthProviders: () =>
    request<{ providers: string[] }>('/auth/oauth/providers').then(r => r.providers),
  oauthCallback: (provider: string, code: string, redirectUri: string, codeVerifier?: string) =>
    request<{ token: string; email: string; role: string }>('/auth/oauth/callback', {
      method: 'POST',
      body: JSON.stringify({ provider, code, redirectUri, codeVerifier }),
    }),

  // Check-in
  validateQr: (token: string) =>
    request<any>('/checkin/validate', { method: 'POST', body: JSON.stringify({ token }) }),
};
