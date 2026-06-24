import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { BRAND_LOGO, BRAND_NAME } from './shared/page-logos';
import { NAV_MENU, NavMenuEntry, NavMenuGroup, filterNavMenu, isGroupActive } from './core/nav-menu';

const HOVER_CLOSE_DELAY_MS = 250;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<div class="layout app-shell" [class.menu-open]="menuOpen" [class.public-page]="isPublicPage()">
  @if(!isPublicPage()){
  @if(menuOpen){ <button type="button" class="nav-backdrop" aria-label="Fechar menu" (click)="closeMenu()"></button> }
  <div class="app-top-nav navbar app-shell-nav" aria-label="Menu principal">
    <div class="app-header-bar">
      <a routerLink="/" class="logo-link" (click)="closeMenu()">
        <img class="nav-brand-logo" [src]="brandLogo" [alt]="brandName" />
      </a>
      <button type="button" class="nav-toggle" [class.is-open]="menuOpen" [attr.aria-expanded]="menuOpen" aria-controls="nav-panel" aria-label="Abrir ou fechar menu" (click)="toggleMenu()">
        <span></span><span></span><span></span>
      </button>
    </div>
    <aside id="nav-panel" class="nav-panel app-drawer" [class.is-open]="menuOpen" aria-label="Navegação">
      <ul class="nav-links">
        @for (entry of navEntries; track trackEntry($index, entry)) {
          @if (entry.type === 'link') {
            <li><a [routerLink]="entry.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!entry.exact }" (click)="closeMenu()">{{ entry.label }}</a></li>
          } @else {
            <li class="nav-item-group" [class.is-open]="isGroupOpen(entry.id)" [class.is-active]="isGroupActive(entry)" (mouseenter)="onGroupEnter(entry.id)" (mouseleave)="onGroupLeave(entry.id)">
              <button type="button" class="nav-group-trigger" [attr.aria-expanded]="isGroupOpen(entry.id)" (click)="toggleGroup(entry.id)">
                {{ entry.label }}<span class="nav-group-chevron" aria-hidden="true"></span>
              </button>
              <ul class="nav-submenu">
                @for (child of entry.children; track child.route) {
                  <li>
                    @if (auth.canShowMenuItem(child.menuItem)) {
                      <a [routerLink]="child.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!child.exact }" (click)="closeMenu()">{{ child.label }}</a>
                    } @else {
                      <span class="nav-submenu-disabled">{{ child.label }}</span>
                    }
                  </li>
                }
              </ul>
            </li>
          }
        }
      </ul>
      <div class="nav-actions">
        @if(auth.user().name){ <p class="nav-user">{{ auth.user().name }}<span>{{ auth.roleDisplay() }}</span></p> }
        <button type="button" class="nav-theme-btn" (click)="theme.toggle()">{{ theme.label() }}</button>
        <a href="#" class="nav-cta" (click)="logout($event)">Sair</a>
      </div>
    </aside>
  </div>
  }
  <main class="main app-content" [class.public-content]="isPublicPage()"><router-outlet /></main>
</div>`,
  styles: [`.layout.public-page { min-height: 100vh; } .main.public-content { padding: 0; max-width: none; }`],
})
export class AppComponent implements OnDestroy {
  menuOpen = false;
  openGroups = new Set<string>();
  hoverGroupId: string | null = null;
  navEntries: NavMenuEntry[] = [];
  readonly brandName = BRAND_NAME;
  readonly brandLogo = BRAND_LOGO;
  private closeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private router: Router, public auth: AuthService, public theme: ThemeService) {
    this.refreshNav();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.refreshNav();
      this.clearHoverGroup();
      this.closeMenu();
    });
  }

  ngOnDestroy() {
    for (const timer of this.closeTimers.values()) clearTimeout(timer);
    this.closeTimers.clear();
  }

  isPublicPage() {
    return (this.router.url.split('?')[0] || '').startsWith('/login');
  }

  trackEntry(_index: number, entry: NavMenuEntry): string {
    return entry.type === 'link' ? entry.route : entry.id;
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu() { this.menuOpen = false; this.openGroups.clear(); this.clearHoverGroup(); }

  onGroupEnter(id: string) { this.clearCloseTimer(id); this.hoverGroupId = id; }
  onGroupLeave(id: string) {
    this.clearCloseTimer(id);
    this.closeTimers.set(id, setTimeout(() => { this.closeTimers.delete(id); if (this.hoverGroupId === id) this.hoverGroupId = null; }, HOVER_CLOSE_DELAY_MS));
  }

  toggleGroup(id: string) { this.openGroups.has(id) ? this.openGroups.delete(id) : this.openGroups.add(id); }
  isGroupOpen(id: string) { return this.hoverGroupId === id || this.openGroups.has(id); }
  isGroupActive(group: NavMenuGroup) { return isGroupActive(this.router.url, group.children); }

  logout(e: Event) {
    e.preventDefault();
    this.closeMenu();
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => { this.auth.clearLocalSession(); this.router.navigateByUrl('/login'); },
    });
  }

  private refreshNav() { this.navEntries = filterNavMenu(NAV_MENU, (item) => this.auth.canShowMenuItem(item)); }
  private clearCloseTimer(id: string) { const t = this.closeTimers.get(id); if (t) { clearTimeout(t); this.closeTimers.delete(id); } }
  private clearHoverGroup() { for (const t of this.closeTimers.values()) clearTimeout(t); this.closeTimers.clear(); this.hoverGroupId = null; }
}
