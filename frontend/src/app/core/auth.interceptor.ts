import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { csrfHeaders, setCsrfToken } from './csrf.util';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function secureClone(req: Parameters<HttpInterceptorFn>[0]) {
  let out = req.clone({ withCredentials: true });
  if (MUTATING.has(req.method)) {
    out = out.clone({ setHeaders: csrfHeaders() });
  }
  return out;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const isLogin = req.url.includes('/auth/login');
  const isRefresh = req.url.includes('/auth/refresh');
  const isPublic = req.url.includes('/public/');

  const authedReq = isLogin ? req.clone({ withCredentials: true }) : secureClone(req);

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 403 && isCsrfError(err) && !req.headers.has('X-CSRF-Retry')) {
        return http.get<{ csrf_token: string }>(`${environment.apiUrl}/auth/csrf`, { withCredentials: true }).pipe(
          switchMap((r) => {
            setCsrfToken(r.csrf_token);
            return next(secureClone(req.clone({ setHeaders: { 'X-CSRF-Retry': '1' } })));
          }),
          catchError(() => throwError(() => err)),
        );
      }
      if (err.status === 401 && !isLogin && !isPublic && !isRefresh) {
        return http.post<{ csrf_token?: string }>(`${environment.apiUrl}/auth/refresh`, {}, {
          withCredentials: true,
        }).pipe(
          switchMap((r) => {
            if (r?.csrf_token) setCsrfToken(r.csrf_token);
            return next(secureClone(req));
          }),
          catchError(() => {
            sessionStorage.removeItem('user');
            setCsrfToken(null);
            router.navigateByUrl('/login');
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};

function isCsrfError(err: HttpErrorResponse): boolean {
  const detail = err.error?.detail;
  if (typeof detail === 'string') return detail.toLowerCase().includes('csrf');
  return false;
}
