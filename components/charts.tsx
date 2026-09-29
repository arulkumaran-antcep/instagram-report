import type { ReactNode } from 'react';
import type { ReportStats } from '@/lib/report-types';
import { fmtCompact, fmtHour, fmtIndex, fmtInt, fmtMonth, fmtPct } from '@/lib/format';
import { cx } from '@/components/ui';

// Series colours validated (dark surface #171f33): lightness band, chroma,
// CVD separation dE 15.4, normal-vision dE 20.5, contrast >= 3:1.
export const SERIES = { a: '#9b72fb', b: '#ec4899' };

function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-1/2 z-10 w-max max-w-240 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-highest px-10 py-8 text-left text-body-sm text-ink opacity-0 shadow-glow transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

function Legend({ items }: { items: { label: string; color?: string; hatched?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-16 gap-y-6 text-body-sm text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-8">
          <span
            aria-hidden
            className={cx('inline-block h-10 w-10 rounded-sm', i.hatched && 'border border-ink-faint')}
            style={i.hatched ? { backgroundImage: HATCH } : { backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const HATCH = 'repeating-linear-gradient(45deg, rgba(203,195,215,0.35) 0 2px, transparent 2px 5px)';

// Share of posts vs share of engagement per bucket: the core "effort vs
// result" comparison. Values sit in the table below; bars show the gap.
export function ShareChart({ rows }: { rows: { name: string; pctPosts: number; pctEngagement: number; index: number; posts: number; median: number }[] }) {
  const max = Math.max(0.01, ...rows.flatMap((r) => [r.pctPosts, r.pctEngagement]));
  return (
    <figure>
      <Legend
        items={[
          { label: 'Share of posts', color: SERIES.a },
          { label: 'Share of engagement', color: SERIES.b },
        ]}
      />
      <div className="mt-16 space-y-14">
        {rows.map((r) => (
          <div
            key={r.name}
            tabIndex={0}
            className="group relative grid grid-cols-1 gap-6 rounded-md outline-none sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_72px] sm:items-center sm:gap-16"
          >
            <span className="truncate text-body-sm text-ink-muted" title={r.name}>
              {r.name}
            </span>
            <div className="space-y-2">
              {[
                { v: r.pctPosts, c: SERIES.a },
                { v: r.pctEngagement, c: SERIES.b },
              ].map((bar, i) => (
                <div key={i} className="h-8 w-full">
                  <div className="h-8 rounded-r-[4px]" style={{ width: `${Math.max(0.6, (bar.v / max) * 100)}%`, backgroundColor: bar.c }} />
                </div>
              ))}
            </div>
            <span className={cx('tabular text-body-sm font-semibold sm:text-right', r.index >= 1 ? 'text-ink' : 'text-ink-subtle')}>
              {fmtIndex(r.index)}×
            </span>
            <Tip>
              <span className="block font-semibold">{r.name}</span>
              <span className="block text-ink-muted">
                {fmtPct(r.pctPosts, 1)} of posts · {fmtPct(r.pctEngagement, 1)} of engagement
              </span>
              <span className="block text-ink-muted">
                Index {fmtIndex(r.index)} · {fmtInt(r.posts)} posts · median {fmtInt(r.median)}
              </span>
            </Tip>
          </div>
        ))}
      </div>
      <figcaption className="mt-14 text-body-sm text-ink-subtle">
        Index = share of engagement ÷ share of posts. Above 1.00 means the bucket earns more than its share.
      </figcaption>
    </figure>
  );
}

function Columns({
  data,
  height = 160,
  label,
}: {
  data: { key: string; value: number; tick: string; muted?: boolean; tip: ReactNode; showTick?: boolean }[];
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={label}>
      <div className="relative flex items-end gap-2 border-b border-line-strong" style={{ height }}>
        {[0.5, 1].map((f) => (
          <div key={f} aria-hidden className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
        ))}
        <span aria-hidden className="tabular absolute -top-18 left-0 text-label-sm text-ink-faint">
          {fmtCompact(max)}
        </span>
        {data.map((d) => (
          <div key={d.key} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end outline-none">
            <div
              className={cx('w-full rounded-t-[4px] transition-opacity group-hover:opacity-80', d.muted && 'border border-b-0 border-ink-faint')}
              style={{
                height: d.value > 0 ? `${Math.max(2, (d.value / max) * 100)}%` : 0,
                backgroundColor: d.muted ? undefined : SERIES.a,
                backgroundImage: d.muted ? HATCH : undefined,
              }}
            />
            <Tip>{d.tip}</Tip>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2" aria-hidden>
        {data.map((d) => (
          <span key={d.key} className="tabular min-w-0 flex-1 truncate text-center text-label-sm text-ink-faint">
            {d.showTick === false ? '' : d.tick}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MonthlyCharts({ months }: { months: ReportStats['months'] }) {
  const tip = (m: ReportStats['months'][number]) => (
    <>
      <span className="block font-semibold">{fmtMonth(m.month)}</span>
      <span className="block text-ink-muted">
        {fmtInt(m.posts)} posts · median {fmtInt(m.median)} · avg {fmtInt(m.avg)}
      </span>
      <span className="block text-ink-muted">
        {fmtPct(m.carouselShare)} carousels · {fmtPct(m.reelShare)} reels
      </span>
    </>
  );
  const tick = (m: string) => fmtMonth(m).replace(/ (\d{2})(\d{2})$/, " '$2");
  return (
    <div className="grid gap-32 xl:grid-cols-2">
      <figure>
        <figcaption className="mb-24 text-body-sm font-semibold text-ink">Median engagement per post, by month</figcaption>
        <Columns
          label="Median engagement per post by month"
          data={months.map((m) => ({ key: m.month, value: m.median, tick: tick(m.month), tip: tip(m) }))}
        />
      </figure>
      <figure>
        <figcaption className="mb-24 text-body-sm font-semibold text-ink">Posts published, by month</figcaption>
        <Columns label="Posts published by month" data={months.map((m) => ({ key: m.month, value: m.posts, tick: tick(m.month), tip: tip(m) }))} />
      </figure>
    </div>
  );
}

export function HourChart({ hours, minSample, timezone }: { hours: ReportStats['hours']; minSample: number; timezone: string }) {
  return (
    <figure>
      <div className="mb-24 flex flex-wrap items-center justify-between gap-12">
        <figcaption className="text-body-sm font-semibold text-ink">Median engagement by posting hour ({timezone})</figcaption>
        <Legend
          items={[
            { label: `${minSample}+ posts (ranked)`, color: SERIES.a },
            { label: `Fewer than ${minSample} posts`, hatched: true },
          ]}
        />
      </div>
      <Columns
        label={`Median engagement by posting hour in ${timezone}`}
        data={hours.map((h) => ({
          key: String(h.hour),
          value: h.median,
          tick: String(h.hour).padStart(2, '0'),
          showTick: h.hour % 3 === 0,
          muted: h.posts < minSample,
          tip: (
            <>
              <span className="block font-semibold">{fmtHour(h.hour)}</span>
              <span className="block text-ink-muted">
                {fmtInt(h.posts)} posts · median {fmtInt(h.median)} · avg {fmtInt(h.avg)}
              </span>
              {h.posts < minSample && <span className="block text-ink-subtle">Too few posts to rank</span>}
            </>
          ),
        }))}
      />
    </figure>
  );
}

export function DayBars({ days }: { days: ReportStats['days'] }) {
  const max = Math.max(1, ...days.map((d) => d.median));
  return (
    <figure>
      <figcaption className="mb-16 text-body-sm font-semibold text-ink">Median engagement by day</figcaption>
      <div className="space-y-8">
        {days.map((d) => (
          <div key={d.day} tabIndex={0} className="group relative grid grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-12 outline-none">
            <span className="text-body-sm text-ink-muted">{d.day.slice(0, 3)}</span>
            <div className="h-8">
              <div className="h-8 rounded-r-[4px]" style={{ width: `${Math.max(1, (d.median / max) * 100)}%`, backgroundColor: SERIES.a }} />
            </div>
            <span className="tabular text-right text-body-sm text-ink">{fmtCompact(d.median)}</span>
            <Tip>
              <span className="block font-semibold">{d.day}</span>
              <span className="block text-ink-muted">
                {fmtInt(d.posts)} posts · median {fmtInt(d.median)} · avg {fmtInt(d.avg)}
              </span>
            </Tip>
          </div>
        ))}
      </div>
    </figure>
  );
}
