export interface AppRouteEntry {
  menuKey: string;
  label: string;
  path: string;
  navGroup?: 'cadastros' | 'comercial' | 'configuracoes';
  exact?: boolean;
}

export const PROTECTED_ROUTES: AppRouteEntry[] = [
  { menuKey: 'dashboard', label: 'Dashboard', path: '/', exact: true },
  { menuKey: 'produtos', label: 'Produtos', path: '/produtos', navGroup: 'cadastros' },
  { menuKey: 'clientes', label: 'Clientes', path: '/clientes', navGroup: 'cadastros' },
  { menuKey: 'estoque', label: 'Estoque', path: '/estoque', navGroup: 'cadastros' },
  { menuKey: 'cotacoes', label: 'Cotações', path: '/cotacoes', navGroup: 'comercial' },
  { menuKey: 'pedidos', label: 'Pedidos', path: '/pedidos', navGroup: 'comercial' },
  { menuKey: 'vendas', label: 'Vendas', path: '/vendas', navGroup: 'comercial' },
  { menuKey: 'campanhas', label: 'Campanhas', path: '/campanhas', navGroup: 'configuracoes' },
  { menuKey: 'informacoes', label: 'Informações', path: '/informacoes', navGroup: 'configuracoes' },
  { menuKey: 'usuarios', label: 'Usuários', path: '/usuarios', navGroup: 'configuracoes' },
];

export function menuKeyForPath(urlPath: string): string | null {
  const p = urlPath.split('?')[0];
  const exact = PROTECTED_ROUTES.find((r) => r.exact && (p === r.path || (r.path === '/' && p === '')));
  if (exact) return exact.menuKey;
  const match = PROTECTED_ROUTES.filter((r) => !r.exact && p.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return match?.menuKey ?? null;
}
