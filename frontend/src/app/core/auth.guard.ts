import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const http = inject(HttpClient);

  if (auth.isAuthenticated()) {
    return true;
  }

  return http.get<any>(`${environment.apiUrl}/auth/me`, { withCredentials: true }).pipe(
    map((u) => {
      auth.hydrateFromUser(u);
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/']);
};

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const segments = route.url.map((s) => s.path).filter(Boolean);
  const path = segments.length ? '/' + segments.join('/') : '/';
  if (auth.canAccessRoute(path)) return true;
  return router.createUrlTree(['/']);
};
