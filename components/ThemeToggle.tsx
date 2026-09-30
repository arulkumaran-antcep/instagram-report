'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cx } from '@/components/ui';

type Theme = 'light' | 'dark';

// Light is the default. The choice is remembered in this browser; the inline
// script in app/layout.tsx applies it before first paint so nothing flashes.
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0b1326' : '#f6f5fb');
    try {
      localStorage.setItem('theme', next);
    } catch {
      // private mode: the choice just isn't remembered
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      className={cx('flex h-40 w-40 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-high hover:text-ink', className)}
    >
      {theme === 'dark' ? <Sun className="h-18 w-18" aria-hidden /> : <Moon className="h-18 w-18" aria-hidden />}
    </button>
  );
}
