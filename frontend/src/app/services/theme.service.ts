import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app-theme-preference';

  readonly currentTheme = signal<ThemeMode>(this.loadThemePreference());

  constructor() {
    effect(() => {
      this.applyTheme(this.currentTheme());
    });
  }

  toggleTheme(): void {
    const nextTheme: ThemeMode = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.currentTheme.set(nextTheme);
  }

  /**
   * Sets a specific theme mode explicitly.
   * @param mode - The desired theme: 'light' | 'dark'
   */
  setTheme(mode: ThemeMode): void {
    this.currentTheme.set(mode);
  }


  isDarkMode(): boolean {
    return this.currentTheme() === 'dark';
  }


  private loadThemePreference(): ThemeMode {
    const stored = localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  private applyTheme(mode: ThemeMode): void {
    const html = document.documentElement;
    if (mode === 'dark') {
      html.setAttribute('data-theme', 'dark');
      html.classList.add('dark-mode');
      html.classList.remove('light-mode');
    } else {
      html.setAttribute('data-theme', 'light');
      html.classList.add('light-mode');
      html.classList.remove('dark-mode');
    }
    localStorage.setItem(this.STORAGE_KEY, mode);
  }
}
