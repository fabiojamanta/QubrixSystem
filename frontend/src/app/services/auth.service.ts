import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  UserProfile,
  MenuItem,
  PermissionMap,
  canShowMenuItem,
  canAccessRoute,
  canWriteMenu,
  canReadMenu,
  isReadOnlyMenu,
  roleLabel,
  canManageProducts,
  canCreateProduct,
  canUpdateProduct,
  canCreateClient,
  canUpdateClient,
  canManageSales,
  canApproveQuotes,
  canManageUsers,
} from '../core/role-permissions';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private permissions: PermissionMap = {};
  private profile: UserProfile | null = null;
  private sessionActive = false;

  constructor(private http: HttpClient, private api: ApiService) {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      this.profile = u.profile ?? null;
      this.permissions = u.permissions ?? {};
      this.sessionActive = !!u.id;
    } catch {
      this.profile = null;
      this.permissions = {};
      this.sessionActive = false;
    }
  }

  isAuthenticated() {
    return this.sessionActive;
  }

  login(email: string, password: string) {
    return this.http.post<{ user: { id?: number; profile?: UserProfile; permissions?: PermissionMap } }>(
      `${this.api.base}/auth/login`,
      { email, password },
      { withCredentials: true },
    ).pipe(tap((r) => this.hydrateFromUser(r.user)));
  }

  hydrateFromUser(u: { id?: number; profile?: UserProfile; permissions?: PermissionMap }) {
    sessionStorage.setItem('user', JSON.stringify(u));
    this.profile = u.profile ?? null;
    this.permissions = u.permissions ?? {};
    this.sessionActive = !!u.id;
  }

  logout() {
    return this.http.post(`${this.api.base}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearLocalSession()),
    );
  }

  clearLocalSession() {
    sessionStorage.removeItem('user');
    this.profile = null;
    this.permissions = {};
    this.sessionActive = false;
  }

  user() {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  userProfile() {
    return this.profile;
  }

  userId(): number | null {
    const id = this.user().id;
    return typeof id === 'number' ? id : null;
  }

  isAdmin() {
    return !!this.profile?.is_admin;
  }

  isManagement() {
    return !!this.profile?.is_admin || !!this.profile?.is_management;
  }

  roleDisplay() {
    return roleLabel(this.profile);
  }

  canShowMenuItem(item: MenuItem) {
    return canShowMenuItem(this.profile, this.permissions, item);
  }

  canAccessRoute(path: string) {
    return canAccessRoute(this.profile, this.permissions, path);
  }

  canWriteMenu(item: MenuItem) {
    return canWriteMenu(this.profile, this.permissions, item);
  }

  canReadMenu(item: MenuItem) {
    return canReadMenu(this.profile, this.permissions, item);
  }

  isReadOnlyMenu(item: MenuItem) {
    return isReadOnlyMenu(this.profile, this.permissions, item);
  }

  canManageProducts() { return canManageProducts(this.profile); }
  canCreateProduct() { return canCreateProduct(this.profile, this.permissions); }
  canUpdateProduct() { return canUpdateProduct(this.profile, this.permissions); }
  canCreateClient() { return canCreateClient(this.profile, this.permissions); }
  canUpdateClient() { return canUpdateClient(this.profile, this.permissions); }
  canManageSales() { return canManageSales(this.profile); }
  canApproveQuotes() { return canApproveQuotes(this.profile); }
  canManageUsers() { return canManageUsers(this.profile, this.permissions); }
}
