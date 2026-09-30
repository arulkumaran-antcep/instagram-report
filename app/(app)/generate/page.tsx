import type { Metadata } from 'next';
import { CalendarRange, FileSpreadsheet, FileText, ShieldCheck, Sparkles, Timer } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { GenerateTabs } from '@/components/GenerateTabs';
import { RecentChips } from '@/components/RecentChips';

export const metadata: Metadata = { title: 'Generate report' };

const WHAT_YOU_GET = [
  { icon: CalendarRange, title: 'Any time span', text: 'Last 3, 6 or 12 months, or exact dates. Every public post in the window, not a small sample.' },
  { icon: Sparkles, title: 'Content buckets', text: 'AI groups posts by what they show and measures which themes earn engagement.' },
  { icon: Timer, title: 'Timing & cadence', text: 'Best hours and days by median engagement, gaps and posting bursts.' },
  { icon: FileText, title: 'Written audit (PDF)', text: 'Findings and prioritised recommendations, every figure checked against the data.' },
  { icon: FileSpreadsheet, title: 'Data workbook (Excel)', text: 'All posts plus the eight analysis tables, ready to filter and pivot.' },
  { icon: ShieldCheck, title: 'Public data only', text: 'Collected without logging in. Private accounts are refused.' },
];

export default async function GeneratePage() {
  await requireMember();
  return (
    <div>
      <section className="relative -mx-16 -mt-24 overflow-clip border-b border-line px-16 pb-40 pt-48 md:-mx-32 md:-mt-32 md:px-32 md:pb-56 md:pt-64">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-200px] h-[480px] w-[960px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(160,120,255,0.18),transparent)]"
        />
        <div className="relative mx-auto max-w-800 text-center">
          <span className="inline-flex h-32 items-center gap-8 rounded-full border border-line-strong bg-surface px-14 text-body-sm text-ink-muted">
            <Sparkles className="h-14 w-14 text-primary" aria-hidden /> Instagram content audit
          </span>
          <h1 className="mt-20 text-headline-lg text-ink md:text-display">
            Audit any public account in <span className="bg-brand-gradient bg-clip-text text-transparent">minutes</span>
          </h1>
          <p className="mx-auto mt-16 max-w-640 text-body-lg text-ink-subtle">
            Enter an Instagram username, or upload an Apify export you already have. You get a written audit as a PDF and a full data workbook.
          </p>
          <div className="mx-auto mt-32 max-w-720 text-left">
            <GenerateTabs />
          </div>
          <RecentChips />
        </div>
      </section>

      <section className="mt-40">
        <h2 className="text-headline-sm text-ink">What every report includes</h2>
        <div className="mt-16 grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3">
          {WHAT_YOU_GET.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-20">
              <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-20 w-20" aria-hidden />
              </div>
              <h3 className="mt-14 text-body-lg font-semibold text-ink">{title}</h3>
              <p className="mt-4 text-body-md text-ink-subtle">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
