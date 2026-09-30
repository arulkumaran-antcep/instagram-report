import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const buttonBase =
  'inline-flex items-center justify-center gap-8 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';
const buttonVariant: Record<Variant, string> = {
  primary: 'bg-brand-gradient text-white hover:brightness-110',
  secondary: 'border border-line-strong bg-surface-high text-ink hover:bg-surface-highest',
  ghost: 'text-ink-muted hover:bg-surface-high hover:text-ink',
  danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
};
const buttonSize: Record<Size, string> = {
  sm: 'h-32 px-12 text-body-sm',
  md: 'h-40 px-16 text-body-md',
  lg: 'h-48 px-24 text-body-lg',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  cx(buttonBase, buttonVariant[variant], buttonSize[size], extra);

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-16 w-16 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export const inputClass =
  'h-44 w-full rounded-lg border border-line-strong bg-canvas-deep px-14 text-body-md text-ink placeholder:text-ink-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-6 block text-body-sm font-medium text-ink-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-6 block text-body-sm text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-6 block text-body-sm text-ink-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('card', className)}>{children}</section>;
}

export function CardHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-12 border-b border-line px-20 py-16 md:px-24">
      <div className="min-w-0">
        <h2 className="text-headline-sm text-ink">{title}</h2>
        {description && <p className="mt-6 max-w-720 text-body-sm text-ink-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
const toneClass: Record<Tone, string> = {
  neutral: 'border-line-strong bg-surface-high text-ink-muted',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  info: 'border-info/30 bg-info/10 text-info',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-24 items-center gap-6 rounded-full border px-10 text-label-sm normal-case', toneClass[tone], className)}>
      {children}
    </span>
  );
}

const avatarPalette = ['from-[#a078ff] to-[#ec4899]', 'from-[#4d8eff] to-[#a078ff]', 'from-[#ec4899] to-[#f59e0b]', 'from-[#14b8a6] to-[#4d8eff]'];

// Initials only: we don't copy or hotlink Instagram profile photos.
export function Avatar({ name, size = 40 }: { name: string; size?: 32 | 40 | 48 | 64 }) {
  const clean = name.replace(/^@/, '');
  const initials = clean.slice(0, 2).toUpperCase();
  const hue = avatarPalette[[...clean].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarPalette.length];
  const dims = { 32: 'h-32 w-32 text-label-sm', 40: 'h-40 w-40 text-body-sm', 48: 'h-48 w-48 text-body-md', 64: 'h-64 w-64 text-headline-sm' }[size];
  return (
    <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white', hue, dims)}>
      {initials}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-24 py-56 text-center">
      <div className="mb-16 flex h-48 w-48 items-center justify-center rounded-xl bg-surface-high text-primary">{icon}</div>
      <h3 className="text-headline-sm text-ink">{title}</h3>
      {children && <div className="mt-6 max-w-420 text-body-md text-ink-subtle">{children}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-24 flex flex-wrap items-end justify-between gap-16 md:mb-32">
      <div className="min-w-0">
        {eyebrow && <p className="label mb-8 text-primary">{eyebrow}</p>}
        <h1 className="text-headline-md text-ink md:text-headline-lg">{title}</h1>
        {description && <p className="mt-6 max-w-640 text-body-md text-ink-subtle md:text-body-lg">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-lg border px-16 py-12 text-body-sm', toneClass[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      {title && <p className="mb-2 font-semibold">{title}</p>}
      <div className="text-ink-muted">{children}</div>
    </div>
  );
}
