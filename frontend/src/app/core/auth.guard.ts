import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

function ensureSession(auth: AuthService) {
  return auth.ensureCsrfToken().pipe(map(() => true));
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const http = inject(HttpClient);

  if (auth.isAuthenticated()) {
    return ensureSession(auth).pipe(
      catchError(() => of(router.createUrlTree(['/login']))),
    );
  }

  return http.get<any>(`${environment.apiUrl}/auth/me`, { withCredentials: true }).pipe(
    switchMap((u) => {
      auth.hydrateFromUser(u);
      return ensureSession(auth);
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
