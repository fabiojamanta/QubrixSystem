import { formatApiError } from '../core/api-error.util';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
@Injectable({providedIn:'root'})
export class ApiService{
  base=environment.apiUrl;
  constructor(private http:HttpClient){}
  private queryParams(params?: Record<string, string | number | null | undefined>) {
    if (!params) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '' && v !== 0) out[k] = String(v);
    }
    return Object.keys(out).length ? out : undefined;
  }
  private creds = { withCredentials: true as const };

  get<T>(path: string, params?: Record<string, string | number | null | undefined>) {
    return this.http.get<T>(`${this.base}${path}`, { ...this.creds, params: this.queryParams(params) });
  }
  post<T>(path: string, body: any) {
    return this.http.post<T>(`${this.base}${path}`, body, this.creds);
  }
  put<T>(path: string, body: any) {
    return this.http.put<T>(`${this.base}${path}`, body, this.creds);
  }
  patch<T>(path: string, body: any) {
    return this.http.patch<T>(`${this.base}${path}`, body, this.creds);
  }
  delete<T>(path: string) {
    return this.http.delete<T>(`${this.base}${path}`, this.creds);
  }
  openPdf(path: string, params?: Record<string, string | number | null | undefined>) {
    this.http
      .get(`${this.base}${path}`, { ...this.creds, responseType: 'blob', params: this.queryParams(params), observe: 'response' })
      .subscribe({
        next: (res) => {
          const blob = res.body;
          if (!blob || blob.size === 0) {
            alert('Não foi possível gerar o PDF');
            return;
          }
          const type = (res.headers.get('Content-Type') || blob.type || '').toLowerCase();
          if (!type.includes('pdf')) {
            blob.text().then((text) => {
              try {
                const err = JSON.parse(text);
                alert(formatApiError(err.detail, 'Não foi possível gerar o PDF'));
              } catch {
                alert('Não foi possível gerar o PDF');
              }
            });
            return;
          }
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 120000);
        },
        error: (e) => {
          alert(formatApiError(e.error?.detail, 'Não foi possível gerar o PDF'));
        },
      });
  }
}
