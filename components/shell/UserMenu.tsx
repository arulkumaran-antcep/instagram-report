'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui';

export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-10 rounded-lg py-4 pl-4 pr-8 hover:bg-surface-high"
      >
        <span className="hidden text-right sm:block">
          <span className="block text-body-sm font-semibold text-ink">{name}</span>
          <span className="block text-label-sm capitalize text-ink-subtle">{role}</span>
        </span>
        <Avatar name={name} size={40} />
        <ChevronDown className="hidden h-16 w-16 text-ink-subtle sm:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-240 rounded-xl border border-line bg-surface-high p-8 shadow-glow">
          <div className="border-b border-line px-10 pb-10 pt-4">
            <p className="truncate text-body-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-body-sm text-ink-subtle">{email}</p>
          </div>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-4 flex h-40 items-center gap-10 rounded-lg px-10 text-body-md text-ink-muted hover:bg-surface-highest hover:text-ink"
          >
            <Settings className="h-16 w-16" aria-hidden /> Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button
              role="menuitem"
              type="submit"
              className="flex h-40 w-full items-center gap-10 rounded-lg px-10 text-left text-body-md text-ink-muted hover:bg-surface-highest hover:text-ink"
            >
              <LogOut className="h-16 w-16" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
