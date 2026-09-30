import { Search } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { dashboardStats } from '@/lib/reports';
import { fmtUsd } from '@/lib/format';
import { Logo, MobileNav, Sidebar } from '@/components/shell/Nav';
import { UserMenu } from '@/components/shell/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const stats = await dashboardStats();

  return (
    <div className="min-h-screen">
      <Sidebar usage={{ reports: stats.thisMonth, spend: fmtUsd(stats.spendThisMonth) }} />
      <div className="lg:pl-280">
        <header className="sticky top-0 z-20 flex h-72 items-center gap-12 border-b border-line bg-canvas/90 px-16 backdrop-blur md:px-32">
          <MobileNav />
          <div className="lg:hidden">
            <Logo />
          </div>
          <form action="/reports" method="get" role="search" className="relative ml-auto hidden w-full max-w-420 md:block lg:ml-0">
            <Search className="pointer-events-none absolute left-14 top-1/2 h-18 w-18 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <input
              name="q"
              type="search"
              placeholder="Search reports by handle…"
              aria-label="Search reports by handle"
              className="h-44 w-full rounded-xl border border-line bg-surface pl-44 pr-14 text-body-md text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <UserMenu name={member.fullName} email={member.email} role={member.role} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-1440 px-16 py-24 md:px-32 md:py-32">{children}</main>
      </div>
    </div>
  );
}
