export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function csrfHeaders(): Record<string, string> {
  const token = getCookie('csrf_token');
  return token ? { 'X-CSRF-Token': token } : {};
}
