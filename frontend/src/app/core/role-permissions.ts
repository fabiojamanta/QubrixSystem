import { menuKeyForPath } from './route-registry';

export type AccessLevel = 'hidden' | 'read' | 'write';

export type UserProfile = {
  id: number;
  name: string;
  slug: string;
  is_admin: boolean;
  is_management?: boolean;
};

export type MenuItem =
  | 'dashboard'
  | 'produtos'
  | 'clientes'
  | 'estoque'
  | 'cotacoes'
  | 'pedidos'
  | 'vendas'
  | 'campanhas'
  | 'informacoes'
  | 'usuarios';

export type PermissionMap = Partial<Record<MenuItem, AccessLevel>>;

function isAdmin(profile: UserProfile | null | undefined): boolean {
  return !!profile?.is_admin;
}

function isManagement(profile: UserProfile | null | undefined): boolean {
  return !!profile?.is_admin || !!profile?.is_management;
}

function level(profile: UserProfile | null | undefined, perms: PermissionMap, menu: MenuItem): AccessLevel {
  if (isAdmin(profile)) return 'write';
  return perms[menu] ?? 'hidden';
}

export function canShowMenuItem(profile: UserProfile | null | undefined, perms: PermissionMap, item: MenuItem): boolean {
  return level(profile, perms, item) !== 'hidden';
}

export function canWriteMenu(profile: UserProfile | null | undefined, perms: PermissionMap, item: MenuItem): boolean {
  return level(profile, perms, item) === 'write';
}

export function canReadMenu(profile: UserProfile | null | undefined, perms: PermissionMap, item: MenuItem): boolean {
  const l = level(profile, perms, item);
  return l === 'read' || l === 'write';
}

export function isReadOnlyMenu(profile: UserProfile | null | undefined, perms: PermissionMap, item: MenuItem): boolean {
  if (isAdmin(profile)) return false;
  return level(profile, perms, item) === 'read';
}

export function canAccessRoute(profile: UserProfile | null | undefined, perms: PermissionMap, path: string): boolean {
  const mk = menuKeyForPath(path.split('?')[0]);
  if (!mk) return true;
  return canShowMenuItem(profile, perms, mk as MenuItem);
}

export function roleLabel(profile: UserProfile | null | undefined): string {
  return profile?.name ?? '';
}

export function canManageProducts(profile: UserProfile | null | undefined) {
  return isManagement(profile);
}

export function canManageSales(profile: UserProfile | null | undefined) {
  return isManagement(profile);
}

export function canApproveQuotes(profile: UserProfile | null | undefined) {
  return isManagement(profile);
}

export function canManageUsers(profile: UserProfile | null | undefined, perms: PermissionMap) {
  return isManagement(profile) && canWriteMenu(profile, perms, 'usuarios');
}

export function canCreateProduct(profile: UserProfile | null | undefined, perms: PermissionMap) {
  return isManagement(profile) && canWriteMenu(profile, perms, 'produtos');
}

export function canUpdateProduct(profile: UserProfile | null | undefined, perms: PermissionMap) {
  return canCreateProduct(profile, perms);
}

export function canCreateClient(profile: UserProfile | null | undefined, perms: PermissionMap) {
  return canWriteMenu(profile, perms, 'clientes');
}

export function canUpdateClient(profile: UserProfile | null | undefined, perms: PermissionMap) {
  return canWriteMenu(profile, perms, 'clientes');
}
