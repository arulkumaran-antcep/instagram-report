'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, History, LayoutDashboard, Menu, Settings, FilePlus2, X } from 'lucide-react';
import { cx } from '@/components/ui';

const ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/generate', label: 'Generate Report', icon: FilePlus2 },
  { href: '/reports', label: 'Report History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'How to use', icon: BookOpen },
];

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-12 rounded-lg" aria-label="InstaReport home">
      <span className="flex h-40 w-40 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
        <svg viewBox="0 0 24 24" className="h-20 w-20" fill="none" stroke="white" strokeWidth="2" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 16v-3M12 16V8M16 16v-5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-headline-sm font-bold tracking-tight text-ink">InstaReport</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex h-44 items-center gap-12 rounded-lg px-14 text-body-md font-medium transition-colors',
              active ? 'bg-primary text-primary-on' : 'text-ink-muted hover:bg-surface-high hover:text-ink',
            )}
          >
            <Icon className="h-20 w-20 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ usage }: { usage: { reports: number; spend: string } }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-280 flex-col border-r border-line bg-surface-low px-20 py-24 lg:flex">
      <div className="mb-32 px-4">
        <Logo />
      </div>
      <NavList />
      <div className="mt-auto rounded-xl border border-line bg-surface p-16">
        <p className="label">This month</p>
        <p className="mt-6 text-body-md text-ink">
          <span className="tabular font-semibold">{usage.reports}</span> report{usage.reports === 1 ? '' : 's'}
          <span className="text-ink-subtle"> · </span>
          <span className="tabular font-semibold">{usage.spend}</span> <span className="text-ink-subtle">API cost</span>
        </p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-40 w-40 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-high lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="h-20 w-20" />
      </button>
      {/* Portal: the sticky header's backdrop blur would otherwise become the
          containing block for this fixed overlay and clip it to the header. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-canvas-deep/80" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-280 flex-col bg-surface-low px-20 py-20 shadow-glow">
            <div className="mb-24 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-40 w-40 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-high"
                aria-label="Close menu"
              >
                <X className="h-20 w-20" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
