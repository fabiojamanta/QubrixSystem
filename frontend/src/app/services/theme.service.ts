import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'ui-theme';
  isDark = false;

  constructor() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'dark' || stored === 'light') {
      this.apply(stored === 'dark');
      return;
    }
    this.apply(window.matchMedia('(prefers-color-scheme: dark)').matches);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.storageKey)) {
        this.apply(e.matches);
      }
    });
  }

  toggle() {
    this.apply(!this.isDark);
    localStorage.setItem(this.storageKey, this.isDark ? 'dark' : 'light');
  }

  label() {
    return this.isDark ? 'Modo claro' : 'Modo escuro';
  }

  private apply(dark: boolean) {
    this.isDark = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }
}
