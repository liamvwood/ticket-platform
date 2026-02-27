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
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : (null as T);
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

  // Events
  getEvents: () => request<any[]>('/events'),
  getEvent: (id: string) => request<any>(`/events/${id}`),
  createEvent: (data: any) =>
    request<any>('/events', { method: 'POST', body: JSON.stringify(data) }),
  publishEvent: (id: string) =>
    request<void>(`/events/${id}/publish`, { method: 'PUT' }),
  createTicketType: (eventId: string, data: any) =>
    request<any>(`/events/${eventId}/ticket-types`, { method: 'POST', body: JSON.stringify(data) }),

  // Orders
  createOrder: (ticketTypeId: string, quantity: number, platformFee = 0, referralCode?: string) => {
    const qs = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : '';
    return request<any>(`/orders${qs}`, { method: 'POST', body: JSON.stringify({ ticketTypeId, quantity, platformFee }) });
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

  // Check-in
  validateQr: (token: string) =>
    request<any>('/checkin/validate', { method: 'POST', body: JSON.stringify({ token }) }),
};
