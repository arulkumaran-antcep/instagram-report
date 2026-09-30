'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, CalendarRange, Globe, Sparkles } from 'lucide-react';
import { PERIODS, TIMEZONES, customRangeBounds, customRangeProblem, parseHandle, type PeriodKey } from '@/lib/handle';
import { Button, Notice, buttonClass, cx } from '@/components/ui';
import { Select } from '@/components/Select';

const dateInput =
  'h-44 w-full rounded-lg border border-line-strong bg-canvas-deep px-12 text-body-md text-ink [color-scheme:dark] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export function GenerateForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('12m');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const bounds = useMemo(() => customRangeBounds(), []);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(bounds.max);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ id: string; handle: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = parseHandle(value);
  const rangeProblem = period === 'custom' ? customRangeProblem(start, end) : null;

  const start_ = async (force = false) => {
    if (!handle) return setError('Enter a valid Instagram username, e.g. natgeo or @natgeo.');
    if (rangeProblem) return setError(rangeProblem);
    setError(null);
    setLoading(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, timezone, period, start, end, force }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setError(data.error ?? 'Could not start the report.');
    }
    if (data.reused && data.status === 'completed' && !force) {
      setLoading(false);
      return setRecent({ id: data.id, handle });
    }
    router.push(`/reports/${data.id}`);
  };

  const submitButton = (className: string) => (
    <Button type="submit" size="lg" loading={loading} className={className}>
      {!loading && <Sparkles className="h-18 w-18" aria-hidden />}
      {loading ? 'Starting…' : 'Generate report'}
    </Button>
  );

  const reset = () => {
    setError(null);
    setRecent(null);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void start_();
      }}
      noValidate
      className="text-left"
    >
      <div className={cx('flex flex-col gap-12', !compact && 'md:flex-row md:rounded-2xl md:border md:border-line md:bg-surface-low md:p-8')}>
        <div className="relative min-w-0 flex-1">
          <AtSign className="pointer-events-none absolute left-16 top-1/2 h-20 w-20 -translate-y-1/2 text-primary" aria-hidden />
          <input
            aria-label="Instagram username"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              reset();
            }}
            placeholder="instagram_handle or profile link"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={cx(
              'w-full rounded-xl border border-line-strong bg-canvas-deep pl-48 pr-16 text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
              compact ? 'h-48 text-body-md' : 'h-56 text-body-lg',
            )}
          />
        </div>
        {!compact && submitButton('hidden md:inline-flex h-56 px-28')}
      </div>

      <div className={cx('mt-12 grid grid-cols-1 gap-12', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 md:mx-auto md:max-w-640')}>
        <div>
          <span className="mb-6 block text-body-sm font-medium text-ink-muted">Time span</span>
          <Select
            label="Time span"
            value={period}
            icon={<CalendarRange className="h-16 w-16" />}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
            onChange={(v) => {
              setPeriod(v);
              reset();
            }}
            menuWidth={300}
          />
        </div>
        <div>
          <span className="mb-6 block text-body-sm font-medium text-ink-muted">Timezone for timing analysis</span>
          <Select
            label="Timezone for timing analysis"
            value={timezone}
            icon={<Globe className="h-16 w-16" />}
            options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={setTimezone}
            menuWidth={280}
          />
        </div>
      </div>

      {period === 'custom' && (
        <div className={cx('mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2', !compact && 'md:mx-auto md:max-w-640')}>
          <label className="block">
            <span className="mb-6 block text-body-sm font-medium text-ink-muted">From</span>
            <input
              type="date"
              aria-label="From date"
              className={dateInput}
              min={bounds.min}
              max={end || bounds.max}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                reset();
              }}
            />
          </label>
          <label className="block">
            <span className="mb-6 block text-body-sm font-medium text-ink-muted">To</span>
            <input
              type="date"
              aria-label="To date"
              className={dateInput}
              min={start || bounds.min}
              max={bounds.max}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                reset();
              }}
            />
          </label>
          <p className={cx('text-body-sm sm:col-span-2', start && rangeProblem ? 'text-danger' : 'text-ink-subtle')}>
            {start && rangeProblem ? rangeProblem : 'Up to 24 months back. Dates are whole days in the selected timezone.'}
          </p>
        </div>
      )}

      <div className={cx('mt-16', !compact && 'md:hidden')}>{submitButton(cx('w-full', compact ? 'h-48 sm:w-auto' : 'h-56'))}</div>

      <p className={cx('mt-12 text-body-sm text-ink-subtle', !compact && 'md:text-center')}>
        Public accounts only · cost depends on how often the account posts (about $0.35 per 100 posts)
      </p>

      {error && (
        <div className="mt-16">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {recent && (
        <div className="mt-16">
          <Notice tone="info" title={`@${recent.handle} was already analysed for this time span in the last 24 hours`}>
            <p>Instagram data barely changes in a day, so opening that report saves time and API cost.</p>
            <div className="mt-12 flex flex-wrap gap-8">
              <Link href={`/reports/${recent.id}`} className={buttonClass('primary', 'sm')}>
                Open existing report
              </Link>
              <Button type="button" variant="secondary" size="sm" onClick={() => void start_(true)} loading={loading}>
                Generate a fresh one anyway
              </Button>
            </div>
          </Notice>
        </div>
      )}
    </form>
  );
}
