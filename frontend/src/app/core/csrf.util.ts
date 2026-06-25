const CSRF_STORAGE_KEY = 'csrf_token';

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCsrfToken(token: string | null | undefined) {
  if (token) {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

export function getCsrfToken(): string | null {
  return sessionStorage.getItem(CSRF_STORAGE_KEY) || getCookie('csrf_token');
}

export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { 'X-CSRF-Token': token } : {};
}
