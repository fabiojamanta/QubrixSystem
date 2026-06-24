import { Component } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BRAND_LOGO, BRAND_TAGLINE } from '../../shared/page-logos';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
<div class="login-page"><div class="login-card">
  <div class="login-brand"><img class="login-logo" [src]="brandLogo" alt="Sistema Marcelo" /></div>
  <p class="login-tagline">{{ brandTagline }}</p>
  @if(error){<div class="error">{{error}}</div>}
  <label>Email</label><input [(ngModel)]="email" placeholder="admin@marcelo.com">
  <label>Senha</label><input [(ngModel)]="password" type="password" placeholder="admin123">
  <button type="button" class="btn btn-block" (click)="login()">Entrar</button>
  <p class="empty">Usuário inicial: admin&#64;marcelo.com / Admin&#64;1234</p>
</div></div>`,
})
export class LoginComponent {
  readonly brandLogo = BRAND_LOGO;
  readonly brandTagline = BRAND_TAGLINE;
  email = 'admin@marcelo.com';
  password = 'Admin@1234';
  error = '';
  constructor(private auth: AuthService, private router: Router) {}
  login() {
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (e) => this.error = formatApiError(e.error?.detail, 'Erro ao entrar'),
    });
  }
}
