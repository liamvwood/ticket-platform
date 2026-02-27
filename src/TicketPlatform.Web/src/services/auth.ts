export interface AuthState {
  token: string | null;
  email: string | null;
  role: string | null;
}

function getState(): AuthState {
  return {
    token: localStorage.getItem('jwt'),
    email: localStorage.getItem('userEmail'),
    role: localStorage.getItem('userRole'),
  };
}

export const auth = {
  get state(): AuthState { return getState(); },
  get isLoggedIn(): boolean { return !!localStorage.getItem('jwt'); },
  get role(): string | null { return localStorage.getItem('userRole'); },

  save(token: string, email: string, role: string) {
    localStorage.setItem('jwt', token);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userRole', role);
    window.dispatchEvent(new CustomEvent('auth-change'));
  },

  logout() {
    localStorage.removeItem('jwt');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    window.dispatchEvent(new CustomEvent('auth-change'));
    navigate('/');
  },
};

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
