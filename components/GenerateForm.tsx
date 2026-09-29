'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Sparkles } from 'lucide-react';
import { TIMEZONES, parseHandle } from '@/lib/handle';
import { Button, Notice, buttonClass, cx } from '@/components/ui';

export function GenerateForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ id: string; handle: string; status: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = parseHandle(value);

  const start = async (force = false) => {
    if (!handle) {
      setError('Enter a valid Instagram username, e.g. natgeo or @natgeo.');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, timezone, force }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? 'Could not start the report.');
      return;
    }
    if (data.reused && data.status === 'completed' && !force) {
      setLoading(false);
      setRecent({ id: data.id, handle, status: data.status });
      return;
    }
    router.push(`/reports/${data.id}`);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
      noValidate
    >
      <div className={cx('flex flex-col gap-12', !compact && 'md:flex-row md:items-stretch md:rounded-2xl md:border md:border-line md:bg-surface-low md:p-8')}>
        <div className="relative flex-1">
          <AtSign className="pointer-events-none absolute left-16 top-1/2 h-20 w-20 -translate-y-1/2 text-primary" aria-hidden />
          <input
            aria-label="Instagram username"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setRecent(null);
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
        <Button type="submit" size="lg" loading={loading} className={compact ? 'h-48' : 'h-56 px-28'}>
          {!loading && <Sparkles className="h-18 w-18" aria-hidden />}
          {loading ? 'Starting…' : 'Generate report'}
        </Button>
      </div>

      <div className={cx('mt-12 flex flex-wrap items-center gap-x-16 gap-y-8 text-body-sm text-ink-subtle', !compact && 'md:justify-center')}>
        <label className="flex items-center gap-8">
          <span>Timezone for timing analysis</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-32 rounded-md border border-line-strong bg-surface px-8 text-body-sm text-ink focus:border-primary focus:outline-none"
          >
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden className="hidden text-ink-faint sm:inline">
          ·
        </span>
        <span>Last 12 months · public accounts only</span>
      </div>

      {error && (
        <div className="mt-16">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {recent && (
        <div className="mt-16">
          <Notice tone="info" title={`@${recent.handle} was already analysed in the last 24 hours`}>
            <p>Instagram data barely changes in a day, so opening that report saves time and API cost.</p>
            <div className="mt-12 flex flex-wrap gap-8">
              <Link href={`/reports/${recent.id}`} className={buttonClass('primary', 'sm')}>
                Open existing report
              </Link>
              <Button type="button" variant="secondary" size="sm" onClick={() => void start(true)} loading={loading}>
                Generate a fresh one anyway
              </Button>
            </div>
          </Notice>
        </div>
      )}
    </form>
  );
}
