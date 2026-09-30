'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '@/components/ui';

export type SelectOption<T extends string> = { value: T; label: string; hint?: string };

type Props<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string; // accessible name
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  menuWidth?: number;
};

// Custom listbox (WAI-ARIA "select-only combobox" pattern). The menu is
// portalled and fixed-positioned so it is never clipped by a card.
export function Select<T extends string>({ value, options, onChange, label, icon, size = 'md', disabled, className, menuWidth }: Props<T>) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, menuWidth ?? 0);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const estimated = Math.min(320, options.length * 44 + 12);
    const up = r.bottom + estimated + 8 > window.innerHeight && r.top > estimated + 8;
    setPos({ left, width, up, top: up ? r.top - 6 : r.bottom + 6 });
  }, [menuWidth, options.length]);

  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex);
    place();
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus();
  };
  const choose = (i: number) => {
    onChange(options[i].value);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !listRef.current?.contains(t)) close(false);
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape' || e.key === 'Tab') return close(e.key === 'Escape');
    else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cx(
          'group flex w-full items-center gap-8 rounded-lg border bg-canvas-deep text-left text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-primary ring-2 ring-primary/30' : 'border-line-strong hover:border-ink-faint',
          size === 'sm' ? 'h-36 px-10 text-body-sm' : 'h-44 px-14 text-body-md',
          className,
        )}
      >
        {icon && <span className="shrink-0 text-ink-subtle">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <ChevronDown className={cx('h-16 w-16 shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            style={{ left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
            className="fixed z-[60] max-h-[320px] overflow-y-auto rounded-xl border border-line-strong bg-surface-high p-6 shadow-glow"
          >
            {options.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={cx(
                    'flex cursor-pointer items-center gap-10 rounded-lg px-10 py-10 text-body-md',
                    i === active ? 'bg-surface-highest text-ink' : 'text-ink-muted',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-body-sm text-ink-subtle">{o.hint}</span>}
                  </span>
                  {isSelected && <Check className="h-16 w-16 shrink-0 text-primary" aria-hidden />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
