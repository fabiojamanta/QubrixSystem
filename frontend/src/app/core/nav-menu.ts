import { MenuItem } from './role-permissions';
import { PROTECTED_ROUTES } from './route-registry';

export interface NavMenuLink {
  label: string;
  route: string;
  menuItem: MenuItem;
  exact?: boolean;
}

export interface NavMenuGroup {
  id: string;
  label: string;
  children: NavMenuLink[];
}

export type NavMenuEntry = ({ type: 'link' } & NavMenuLink) | ({ type: 'group' } & NavMenuGroup);

const GROUP_LABELS: Record<string, string> = {
  cadastros: 'Cadastros',
  comercial: 'Comercial',
  configuracoes: 'Configurações',
};

function buildNavMenu(): NavMenuEntry[] {
  const entries: NavMenuEntry[] = [];
  const dash = PROTECTED_ROUTES.find((r) => r.menuKey === 'dashboard');
  if (dash) {
    entries.push({ type: 'link', label: dash.label, route: dash.path, menuItem: 'dashboard', exact: true });
  }
  const groups = new Map<string, NavMenuLink[]>();
  for (const r of PROTECTED_ROUTES) {
    if (!r.navGroup) continue;
    const item: NavMenuLink = { label: r.label, route: r.path, menuItem: r.menuKey as MenuItem, exact: r.exact };
    const list = groups.get(r.navGroup) ?? [];
    list.push(item);
    groups.set(r.navGroup, list);
  }
  for (const [id, children] of groups) {
    entries.push({ type: 'group', id, label: GROUP_LABELS[id] ?? id, children });
  }
  return entries;
}

export const NAV_MENU: NavMenuEntry[] = buildNavMenu();

export function filterNavMenu(menu: NavMenuEntry[], canShow: (item: MenuItem) => boolean): NavMenuEntry[] {
  const result: NavMenuEntry[] = [];
  for (const entry of menu) {
    if (entry.type === 'link') {
      if (canShow(entry.menuItem)) result.push(entry);
      continue;
    }
    const children = entry.children.filter((child) => canShow(child.menuItem));
    if (children.length) result.push({ ...entry, children });
  }
  return result;
}

export function isRouteActive(url: string, route: string, exact = false): boolean {
  const path = url.split('?')[0];
  if (exact) return path === route || (route === '/' && path === '');
  return path === route || path.startsWith(`${route}/`);
}

export function isGroupActive(url: string, children: NavMenuLink[]): boolean {
  return children.some((child) => isRouteActive(url, child.route, child.exact));
}
