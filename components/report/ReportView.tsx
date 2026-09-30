import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, BadgeCheck, Briefcase, Clock, ExternalLink, FileSpreadsheet, FileText, Lightbulb, ShieldCheck } from 'lucide-react';
import type { NarrativeBullet, ReportRow } from '@/lib/report-types';
import { fmtCompact, fmtDate, fmtDateTime, fmtIndex, fmtInt, fmtPct, fmtRate, fmtUsd, periodLabel } from '@/lib/format';
import { Avatar, Badge, buttonClass, cx } from '@/components/ui';
import { DayBars, HourChart, MonthlyCharts, ShareChart } from '@/components/charts';
import { RegenerateButton } from '@/components/report/RegenerateButton';
import { DeleteReportButton } from '@/components/DeleteReportButton';
import { SectionNav } from '@/components/report/SectionNav';

function Bullets({ items }: { items: NarrativeBullet[] }) {
  return (
    <ul className="space-y-12">
      {items.map((b, i) => (
        <li key={i} className="flex gap-12 text-body-md leading-[22px] text-ink-muted">
          <span aria-hidden className="mt-8 h-6 w-6 shrink-0 rounded-full bg-primary" />
          <span>
            <strong className="font-semibold text-ink">{b.lead}</strong> {b.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-96">
      <div className="mb-16">
        <h2 className="text-headline-sm text-ink md:text-headline-md">{title}</h2>
        {description && <p className="mt-4 text-body-md text-ink-subtle">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DataTable({ head, rows, align }: { head: string[]; rows: ReactNode[][]; align?: ('left' | 'right')[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cx('label px-16 py-12 font-medium', align?.[i] === 'right' && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cx('px-16 py-12 text-body-md text-ink', align?.[j] === 'right' && 'tabular text-right')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportView({ report, canDelete }: { report: ReportRow; canDelete: boolean }) {
  const { profile, stats, narrative, cost } = report;
  if (!profile || !stats || !narrative) return null;
  const o = stats.overview;
  const tz = stats.window.timezone;
  const section = (key: string) => narrative.sections.find((s) => s.key === key);
  const benchmark = o.engagementRate < 1 ? { tone: 'warning' as const, text: 'Below 1–3% benchmark' } : o.engagementRate > 3 ? { tone: 'success' as const, text: 'Above 1–3% benchmark' } : { tone: 'info' as const, text: 'Within 1–3% benchmark' };

  const nav = [
    ['snapshot', 'Snapshot'],
    ['buckets', 'Content buckets'],
    ['formats', 'Formats'],
    ['trajectory', 'Trajectory'],
    ['timing', 'Timing'],
    ['captions', 'Captions & hashtags'],
    ['collabs', 'Collabs & audio'],
    ['top-posts', 'Top posts'],
    ['recommendations', 'Recommendations'],
  ];

  return (
    <div className="space-y-24 md:space-y-32">
      {/* Action bar */}
      <div className="card flex flex-wrap items-center gap-12 p-12 md:px-16">
        <Link href="/reports" className={buttonClass('ghost', 'md')}>
          <ArrowLeft className="h-16 w-16" aria-hidden /> Report history
        </Link>
        <span className="flex items-center gap-6 text-body-sm text-ink-subtle">
          <Clock className="h-14 w-14" aria-hidden /> {fmtDateTime(report.completed_at ?? report.created_at)} · by {report.created_by_name ?? 'former member'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-8">
          <RegenerateButton
            handle={report.handle}
            timezone={report.timezone}
            span={report}
            confirm={
              report.source === 'upload'
                ? `Run the analysis again on the same uploaded data for @${report.handle}? It uses AI again and costs about ${fmtUsd(cost?.claudeUsd ?? 0.6)}.`
                : `Generate a fresh report for @${report.handle}? It collects the latest data and costs about ${fmtUsd(cost?.totalUsd ?? 2.5)} in API usage.`
            }
          />
          <a href={`/api/reports/${report.id}/download?format=xlsx`} className={buttonClass('secondary', 'md')}>
            <FileSpreadsheet className="h-16 w-16" aria-hidden /> Excel
          </a>
          <a href={`/api/reports/${report.id}/download?format=pdf`} className={buttonClass('primary', 'md')}>
            <FileText className="h-16 w-16" aria-hidden /> Download PDF
          </a>
          {canDelete && <DeleteReportButton id={report.id} handle={report.handle} redirectTo="/reports" />}
        </div>
      </div>

      {/* Profile header */}
      <section className="card relative overflow-clip p-20 md:p-28">
        <div className="relative grid grid-cols-1 gap-24 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 gap-16 md:gap-20">
            <Avatar name={profile.username} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-8">
                <h1 className="truncate text-headline-md text-ink md:text-headline-lg">@{profile.username}</h1>
                {profile.isVerified && (
                  <Badge tone="info">
                    <BadgeCheck className="h-14 w-14" aria-hidden /> Verified
                  </Badge>
                )}
                {profile.category && (
                  <Badge tone="primary">
                    <Briefcase className="h-12 w-12" aria-hidden /> {profile.category}
                  </Badge>
                )}
              </div>
              {profile.fullName && <p className="mt-2 text-body-lg font-medium text-ink-muted">{profile.fullName}</p>}
              {profile.biography && <p className="mt-8 max-w-640 whitespace-pre-line text-body-md text-ink-subtle">{profile.biography}</p>}
              <div className="mt-10 flex flex-wrap gap-x-16 gap-y-6 text-body-sm text-ink-subtle">
                <a href={`https://www.instagram.com/${profile.username}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-6 text-primary hover:underline">
                  View on Instagram <ExternalLink className="h-12 w-12" aria-hidden />
                </a>
                <span>
                  {periodLabel(stats.window)}
                  {!stats.window.custom && ` (${fmtDate(stats.window.start)} – ${fmtDate(stats.window.end)})`} · {tz}
                  {stats.window.truncated && ' · most recent posts up to the collection limit'}
                </span>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface-low">
            {[
              { k: 'Followers', v: fmtCompact(profile.followers), n: profile.following != null ? `follows ${fmtInt(profile.following)}` : 'as entered' },
              { k: 'Engagement rate', v: fmtRate(o.engagementRate), n: benchmark.text },
              { k: 'Posts analysed', v: fmtInt(o.posts), n: `${o.postsPerWeek.toFixed(1)} per week` },
            ].map((x) => (
              <div key={x.k} className="px-14 py-14 text-center md:px-24">
                <dt className="label">{x.k}</dt>
                <dd className="tabular mt-6 text-headline-md text-ink">{x.v}</dd>
                <dd className="mt-2 text-label-sm normal-case tracking-normal text-ink-subtle">{x.n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Key finding */}
      {narrative.headline && (
        <section className="rounded-xl bg-brand-gradient p-px">
          <div className="flex gap-14 rounded-[11px] bg-surface p-20 md:p-24">
            <span className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightbulb className="h-20 w-20" aria-hidden />
            </span>
            <div>
              <p className="label text-primary">Key finding</p>
              <p className="mt-6 text-body-lg font-medium text-ink md:text-headline-sm md:font-medium">{narrative.headline}</p>
            </div>
          </div>
        </section>
      )}

      {/* In-page nav */}
      <SectionNav items={nav as [string, string][]} />

      <div className="grid grid-cols-1 gap-24 md:gap-32 xl:grid-cols-2">
        <div className="card scroll-mt-[136px] p-20 md:p-28 xl:col-span-2" id="snapshot">
          <Section id="snapshot-h" title="Account snapshot">
            <div className="mb-20 grid grid-cols-2 gap-10 md:gap-12 lg:grid-cols-4">
              {[
                { k: 'Avg engagement / post', v: fmtCompact(o.avgEngagement), n: `median ${fmtCompact(o.medianEngagement)}` },
                { k: 'Comments per 100 likes', v: o.commentsPer100LikesMedian.toFixed(1), n: 'median post' },
                { k: 'Posts without caption', v: fmtPct(o.captionlessShare), n: `${fmtInt(Math.round(o.captionlessShare * o.posts))} of ${fmtInt(o.posts)}` },
                { k: 'Hidden like counts', v: fmtInt(o.hiddenLikePosts), n: o.hiddenLikePosts ? 'excluded from averages' : 'rates are accurate' },
              ].map((x) => (
                <div key={x.k} className="min-w-0 rounded-xl border border-line bg-surface-low p-12 md:p-16">
                  <p className="label">{x.k}</p>
                  <p className="tabular mt-8 text-headline-sm text-ink md:text-headline-md">{x.v}</p>
                  <p className="mt-2 text-body-sm text-ink-subtle">{x.n}</p>
                </div>
              ))}
            </div>
            <Bullets items={section('snapshot')?.bullets ?? []} />
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28 xl:col-span-2" id="buckets">
          <Section id="buckets-h" title="Content buckets" description="What the account posts, and which themes earn their share of engagement.">
            <div className="grid grid-cols-1 gap-32 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ShareChart rows={stats.buckets} />
              <Bullets items={section('buckets')?.bullets ?? []} />
            </div>
            <div className="mt-24 rounded-xl border border-line">
              <DataTable
                head={['Bucket', 'Posts', '% posts', '% engagement', 'Index', 'Median']}
                align={['left', 'right', 'right', 'right', 'right', 'right']}
                rows={stats.buckets.map((b) => [
                  <span key="n" className="block">
                    <span className="font-medium text-ink">{b.name}</span>
                    <span className="block text-body-sm text-ink-subtle">{b.definition}</span>
                  </span>,
                  fmtInt(b.posts),
                  fmtPct(b.pctPosts, 1),
                  fmtPct(b.pctEngagement, 1),
                  <span key="i" className={b.index >= 1 ? 'font-semibold text-ink' : 'text-ink-subtle'}>
                    {fmtIndex(b.index)}
                  </span>,
                  fmtInt(b.median),
                ])}
              />
            </div>
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28" id="formats">
          <Section id="formats-h" title="Formats">
            <div className="rounded-xl border border-line">
              <DataTable
                head={['Format', 'Posts', '% eng.', 'Index', 'Median']}
                align={['left', 'right', 'right', 'right', 'right']}
                rows={stats.formats.map((f) => [f.format, `${fmtInt(f.posts)} (${fmtPct(f.pctPosts)})`, fmtPct(f.pctEngagement), fmtIndex(f.index), fmtInt(f.median)])}
              />
            </div>
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28" id="opportunities">
          <Section id="opportunities-h" title="Gaps & opportunities">
            <Bullets items={section('opportunities')?.bullets ?? []} />
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28 xl:col-span-2" id="trajectory">
          <Section
            id="trajectory-h"
            title="Trajectory"
            description={`Average engagement ${fmtCompact(stats.halves.first.avg)} in the first half of the window vs ${fmtCompact(stats.halves.second.avg)} in the second (${stats.halves.avgChangePct > 0 ? '+' : ''}${stats.halves.avgChangePct}%).`}
          >
            <MonthlyCharts months={stats.months} />
            <div className="mt-24">
              <Bullets items={section('trajectory')?.bullets ?? []} />
            </div>
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28 xl:col-span-2" id="timing">
          <Section id="timing-h" title={`Timing (${tz})`}>
            <div className="grid grid-cols-1 gap-32 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <HourChart hours={stats.hours} minSample={stats.timing.minSample} timezone={tz} />
              <DayBars days={stats.days} />
            </div>
            <div className="mt-24">
              <Bullets items={section('timing')?.bullets ?? []} />
            </div>
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28" id="captions">
          <Section id="captions-h" title="Captions & hashtags">
            <Bullets items={[...(section('captions')?.bullets ?? []), ...(section('hashtags')?.bullets ?? [])]} />
            <div className="mt-20 rounded-xl border border-line">
              <DataTable
                head={['Caption length', 'Posts', 'Median']}
                align={['left', 'right', 'right']}
                rows={stats.captions.lengthBuckets.map((b) => [b.range === '0' ? 'No caption' : `${b.range} chars`, fmtInt(b.posts), fmtInt(b.median)])}
              />
            </div>
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28" id="collabs">
          <Section id="collabs-h" title="Collabs & audio">
            <Bullets items={section('collabs')?.bullets ?? []} />
            {stats.collabs.collaborators.length > 0 && (
              <div className="mt-20 rounded-xl border border-line">
                <DataTable
                  head={['Collaborator', 'Posts', 'Avg eng.']}
                  align={['left', 'right', 'right']}
                  rows={stats.collabs.collaborators.slice(0, 6).map((c) => [`@${c.username}`, fmtInt(c.posts), fmtInt(c.avg)])}
                />
              </div>
            )}
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28 xl:col-span-2" id="top-posts">
          <Section id="top-posts-h" title="Top 10 posts" description="Ranked by engagement (likes + comments). Open a post to see it on Instagram.">
            <div className="rounded-xl border border-line">
              <DataTable
                head={['Date', 'Format', 'Bucket', 'Likes', 'Comments', 'What it shows', '']}
                align={['left', 'left', 'left', 'right', 'right', 'left', 'right']}
                rows={stats.topPosts.map((p) => [
                  <span key="d" className="whitespace-nowrap">
                    {fmtDate(p.date)}
                  </span>,
                  p.format,
                  <span key="b" className="text-ink-muted">
                    {p.bucket}
                  </span>,
                  fmtInt(p.likes),
                  fmtInt(p.comments),
                  <span key="s" className="block max-w-320 text-body-sm text-ink-subtle">
                    {p.note || p.caption || '—'}
                  </span>,
                  <a key="l" href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-4 whitespace-nowrap text-primary hover:underline">
                    Open <ExternalLink className="h-12 w-12" aria-hidden />
                  </a>,
                ])}
              />
            </div>
          </Section>
        </div>

        <div className="card scroll-mt-[136px] p-20 md:p-28 xl:col-span-2" id="recommendations">
          <Section id="recommendations-h" title="Recommendations" description="In priority order. Each one cites the numbers behind it.">
            <ol className="grid grid-cols-1 gap-16 lg:grid-cols-2">
              {narrative.recommendations.map((r, i) => (
                <li key={i} className="flex gap-14 rounded-xl border border-line bg-surface-low p-16 md:p-20">
                  <span className="tabular flex h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-body-sm font-bold text-primary">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-body-lg font-semibold text-ink">{r.title.replace(/\.$/, '')}</h3>
                    <p className="mt-4 text-body-md text-ink-muted">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <footer className="flex flex-wrap items-start gap-12 rounded-xl border border-line p-16 text-body-sm text-ink-subtle md:p-20">
        <ShieldCheck className="mt-2 h-16 w-16 shrink-0 text-ink-faint" aria-hidden />
        <p className="flex-1">
          Based on publicly visible Instagram data collected without logging in. Engagement = likes + comments. Content buckets are assigned by AI and may misclassify
          individual posts. Reach, impressions, saves and audience demographics are not public and are not estimated. {narrative.verification.checkedNumbers} figures in the
          written analysis were checked against the data. Internal use only.
          {cost ? ` Generation cost ${fmtUsd(cost.totalUsd)} (${fmtInt(cost.postsCollected)} posts, ${fmtInt(cost.imagesAnalysed)} images).` : ''}
        </p>
      </footer>
    </div>
  );
}
