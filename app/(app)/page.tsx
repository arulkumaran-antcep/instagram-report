import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, FileText, Sparkles, Wallet } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { dashboardStats, listReports } from '@/lib/reports';
import { fmtCompact, fmtRate, fmtUsd, timeAgo } from '@/lib/format';
import { Avatar, ButtonLink, Card, CardHeader, EmptyState } from '@/components/ui';
import { GenerateForm } from '@/components/GenerateForm';
import { StatusBadge } from '@/components/StatusBadge';

export const metadata: Metadata = { title: 'Dashboard' };

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

export default async function DashboardPage() {
  const member = await requireMember();
  const [stats, recent] = await Promise.all([dashboardStats(), listReports({ pageSize: 6 })]);

  const tiles = [
    { icon: FileText, label: 'Reports this month', value: String(stats.thisMonth), note: `${stats.completedThisMonth} completed · ${stats.failedThisMonth} failed` },
    { icon: CheckCircle2, label: 'Completed all time', value: String(stats.allTimeCompleted), note: 'Available in Report History' },
    {
      icon: Clock3,
      label: 'Avg generation time',
      value: stats.avgMinutes == null ? '—' : `${stats.avgMinutes.toFixed(1)} min`,
      note: 'This month, completed reports',
    },
    { icon: Wallet, label: 'API cost this month', value: fmtUsd(stats.spendThisMonth), note: 'Apify + Anthropic, measured per report' },
  ];

  return (
    <div className="space-y-24 md:space-y-32">
      <section className="card relative overflow-clip p-16 md:p-32">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-120px] top-[-160px] h-[360px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(236,72,153,0.12),transparent)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-16">
          <div>
            <h1 className="text-headline-md text-ink md:text-headline-xl">
              {greeting()}, {member.fullName.split(' ')[0]}
            </h1>
            <p className="mt-6 text-body-md text-ink-subtle md:text-body-lg">
              {stats.active > 0 ? `${stats.active} report${stats.active === 1 ? ' is' : 's are'} being generated right now.` : 'Everything is up to date.'}
            </p>
          </div>
          <ButtonLink href="/reports" variant="secondary">
            Report history <ArrowRight className="h-16 w-16" aria-hidden />
          </ButtonLink>
        </div>
        <div className="relative mt-20 grid grid-cols-2 gap-10 md:mt-24 md:gap-12 xl:grid-cols-4">
          {tiles.map(({ icon: Icon, label, value, note }) => (
            <div key={label} className="min-w-0 rounded-xl border border-line bg-surface-low p-12 md:p-16">
              <div className="flex items-center gap-10">
                <span className="hidden h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                  <Icon className="h-16 w-16" aria-hidden />
                </span>
                <span className="label">{label}</span>
              </div>
              <p className="tabular mt-8 text-headline-md text-ink md:mt-12 md:text-headline-lg">{value}</p>
              <p className="mt-2 text-body-sm text-ink-subtle">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-24 xl:grid-cols-[minmax(0,1fr)_420px] md:gap-32">
        <Card className="p-16 md:p-28">
          <div className="flex items-start gap-14">
            <span className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg bg-brand-gradient">
              <Sparkles className="h-20 w-20 text-white" aria-hidden />
            </span>
            <div>
              <h2 className="text-headline-sm text-ink">Run a new audit</h2>
              <p className="mt-2 text-body-md text-ink-subtle">Content buckets, timing, trajectory and recommendations for any time span, as a PDF plus an Excel workbook.</p>
            </div>
          </div>
          <div className="mt-20">
            <GenerateForm compact />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent reports"
            action={
              <Link href="/reports" className="text-body-sm font-semibold text-primary hover:underline">
                View all
              </Link>
            }
          />
          {recent.rows.length === 0 ? (
            <EmptyState icon={<FileText className="h-24 w-24" />} title="No reports yet">
              Generate your first audit and it will appear here.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {recent.rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/reports/${r.id}`} className="flex items-center gap-12 px-20 py-14 transition-colors hover:bg-surface-high md:px-24">
                    <Avatar name={r.handle} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md font-semibold text-ink">@{r.handle}</span>
                      <span className="block truncate text-body-sm text-ink-subtle">
                        {r.profile ? `${fmtCompact(r.profile.followers)} followers · ` : ''}
                        {r.engagementRate != null ? `${fmtRate(r.engagementRate)} ER · ` : ''}
                        {timeAgo(r.created_at)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
