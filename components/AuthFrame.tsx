import { ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/shell/Nav';

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-16 py-48">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-240px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(160,120,255,0.22),transparent)]"
      />
      <div className="relative w-full max-w-420">
        <div className="mb-32 flex justify-center">
          <Logo />
        </div>
        <div className="card p-24 shadow-glow md:p-32">
          <h1 className="text-headline-md text-ink">{title}</h1>
          <p className="mt-4 text-body-md text-ink-subtle">{subtitle}</p>
          <div className="mt-24">{children}</div>
        </div>
        <p className="mt-20 flex items-center justify-center gap-6 text-body-sm text-ink-faint">
          <ShieldCheck className="h-16 w-16" aria-hidden /> Private workspace · team members only
        </p>
      </div>
    </div>
  );
}
