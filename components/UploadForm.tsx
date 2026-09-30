'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, FileSpreadsheet, Globe, Sparkles, UploadCloud, X } from 'lucide-react';
import { TIMEZONES, parseHandle } from '@/lib/handle';
import { fmtDate } from '@/lib/format';
import { Button, Notice, cx } from '@/components/ui';
import { Select } from '@/components/Select';

type Summary = {
  handle: string;
  posts: number;
  from: string;
  to: string;
  fileFrom: string;
  fileTo: string;
  followersInFile: number | null;
  imagesAvailable: number;
  skipped: { otherAccounts: number; unusable: number; duplicates: number };
};

const ACCEPT = '.xlsx,.csv,.json';
const MAX_BYTES = 15 * 1024 * 1024;
const input =
  'h-44 w-full rounded-lg border border-line-strong bg-canvas-deep px-12 text-body-md text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';

export function UploadForm() {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [followers, setFollowers] = useState('');
  const [handle, setHandle] = useState('');
  const [span, setSpan] = useState<'all' | 'custom'>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [needHandle, setNeedHandle] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  type Range = { start: string; end: string } | null;
  const send = (intent: 'preview' | 'create', f: File, tz = timezone, h = handle, range: Range = span === 'custom' ? { start, end } : null) => {
    const body = new FormData();
    body.set('file', f);
    body.set('intent', intent);
    body.set('timezone', tz);
    if (h) body.set('handle', h);
    if (range) {
      body.set('start', range.start);
      body.set('end', range.end);
    }
    if (intent === 'create') {
      body.set('followers', followers);
      body.set('confirm', confirmed ? 'yes' : 'no');
    }
    return fetch('/api/reports/upload', { method: 'POST', body });
  };

  const clear = () => {
    setFile(null);
    setSummary(null);
    setError(null);
    setNeedHandle(false);
    setConfirmed(false);
    if (picker.current) picker.current.value = '';
  };

  const read = async (f: File, tz = timezone, h = handle, range: Range = null) => {
    setError(null);
    if (!range) setSummary(null);
    if (!/\.(xlsx|csv|json)$/i.test(f.name)) return setError('Upload an Excel (.xlsx), CSV or JSON file exported from the Apify Instagram Scraper.');
    if (f.size > MAX_BYTES) return setError('That file is larger than 15 MB. Export one account at a time.');
    setFile(f);
    setReading(true);
    const res = await send('preview', f, tz, h, range);
    const data = await res.json().catch(() => ({}));
    setReading(false);
    if (!res.ok) {
      if (/which account/i.test(data.error ?? '')) setNeedHandle(true);
      return setError(data.error ?? 'Could not read that file.');
    }
    if (range) {
      // Keep the file's full span; only the counts for the chosen dates change.
      setSummary((prev) => (prev ? { ...data, fileFrom: prev.fileFrom, fileTo: prev.fileTo } : data));
    } else {
      setSummary(data);
      setSpan('all');
      setStart(data.fileFrom);
      setEnd(data.fileTo);
    }
    setNeedHandle(false);
  };

  const submit = async () => {
    if (!file || !summary) return;
    if (!summary.followersInFile && !(Number(followers) > 0)) return setError('Enter the account’s follower count.');
    if (!confirmed) return setError('Please confirm the data is from a public account, collected lawfully.');
    if (span === 'custom' && (!start || !end || end < start)) return setError('Choose a valid start and end date.');
    setError(null);
    setLoading(true);
    const res = await send('create', file);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setError(data.error ?? 'Could not start the report.');
    }
    router.push(`/reports/${data.id}`);
  };

  return (
    <div className="text-left">
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void read(f);
          }}
          className={cx(
            'flex flex-col items-center rounded-2xl border border-dashed px-16 py-32 text-center transition-colors md:px-32 md:py-40',
            dragging ? 'border-primary bg-primary/10' : 'border-line-strong bg-surface-low',
          )}
        >
          <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud className="h-24 w-24" aria-hidden />
          </div>
          <p className="mt-16 text-body-lg font-semibold text-ink">Drop the Apify export here</p>
          <p className="mt-4 text-body-md text-ink-subtle">Excel (.xlsx), CSV or JSON from the Instagram Scraper · up to 15 MB</p>
          <Button type="button" variant="secondary" className="mt-20" onClick={() => picker.current?.click()}>
            Choose a file
          </Button>
          <input ref={picker} type="file" accept={ACCEPT} className="sr-only" aria-label="Apify export file" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface-low p-16 md:p-24">
          <div className="flex items-center gap-12">
            <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-20 w-20" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-md font-semibold text-ink">{file.name}</p>
              <p className="text-body-sm text-ink-subtle">{reading ? 'Reading the file…' : `${Math.max(1, Math.round(file.size / 1024))} KB`}</p>
            </div>
            <button type="button" onClick={clear} aria-label="Remove file" className="flex h-36 w-36 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-highest hover:text-ink">
              <X className="h-18 w-18" aria-hidden />
            </button>
          </div>

          {needHandle && (
            <div className="mt-16">
              <label className="mb-6 block text-body-sm font-medium text-ink-muted" htmlFor="up-handle">
                Instagram username
              </label>
              <div className="flex gap-8">
                <input id="up-handle" className={input} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="username" autoCapitalize="none" spellCheck={false} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const h = parseHandle(handle);
                    if (!h) return setError('Enter a valid Instagram username.');
                    setHandle(h);
                    void read(file, timezone, h);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {summary && (
            <>
              <dl className="mt-16 grid grid-cols-2 gap-12 rounded-xl bg-canvas-deep p-16 sm:grid-cols-4">
                {[
                  ['Account', `@${summary.handle}`],
                  ['Posts found', summary.posts.toLocaleString('en-US')],
                  ['From', fmtDate(summary.from)],
                  ['To', fmtDate(summary.to)],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="label">{k}</dt>
                    <dd className="mt-4 truncate text-body-md font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {summary.skipped.otherAccounts + summary.skipped.duplicates > 0 && (
                <p className="mt-8 text-body-sm text-ink-subtle">
                  Left out: {summary.skipped.otherAccounts} rows from other accounts, {summary.skipped.duplicates} duplicates.
                </p>
              )}
              {summary.imagesAvailable < summary.posts * 0.5 && (
                <div className="mt-12">
                  <Notice tone="warning" title="Few post images in this file">
                    Content categories are more accurate when the export includes the displayUrl column. The report will fall back to captions.
                  </Notice>
                </div>
              )}
              <p className="mt-8 text-body-sm text-ink-subtle">
                Image links in Apify exports expire after a few days, so upload soon after exporting for the best content analysis.
              </p>

              <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-6 block text-body-sm font-medium text-ink-muted">Time span</span>
                  <Select
                    label="Time span"
                    value={span}
                    icon={<CalendarRange className="h-16 w-16" />}
                    options={[
                      { value: 'all', label: 'Everything in the file', hint: `${fmtDate(summary.fileFrom)} – ${fmtDate(summary.fileTo)}` },
                      { value: 'custom', label: 'Custom dates', hint: 'Analyse only part of the file' },
                    ]}
                    onChange={(v) => {
                      setSpan(v);
                      if (v === 'all') {
                        setStart(summary.fileFrom);
                        setEnd(summary.fileTo);
                        void read(file, timezone, handle);
                      }
                    }}
                    menuWidth={320}
                  />
                </div>
                {span === 'custom' && (
                  <>
                    <label className="block">
                      <span className="mb-6 block text-body-sm font-medium text-ink-muted">From</span>
                      <input
                        type="date"
                        aria-label="From date"
                        className={cx(input, '[color-scheme:dark]')}
                        min={summary.fileFrom}
                        max={end || summary.fileTo}
                        value={start}
                        onChange={(e) => {
                          setStart(e.target.value);
                          if (e.target.value && end) void read(file, timezone, handle, { start: e.target.value, end });
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-6 block text-body-sm font-medium text-ink-muted">To</span>
                      <input
                        type="date"
                        aria-label="To date"
                        className={cx(input, '[color-scheme:dark]')}
                        min={start || summary.fileFrom}
                        max={summary.fileTo}
                        value={end}
                        onChange={(e) => {
                          setEnd(e.target.value);
                          if (start && e.target.value) void read(file, timezone, handle, { start, end: e.target.value });
                        }}
                      />
                    </label>
                    <p className="text-body-sm text-ink-subtle sm:col-span-2">
                      The file covers {fmtDate(summary.fileFrom)} – {fmtDate(summary.fileTo)}. Dates are whole days in the selected timezone.
                    </p>
                  </>
                )}
                <div>
                  <label className="mb-6 block text-body-sm font-medium text-ink-muted" htmlFor="up-followers">
                    Followers {summary.followersInFile ? '(from file)' : ''}
                  </label>
                  <input
                    id="up-followers"
                    inputMode="numeric"
                    className={input}
                    value={summary.followersInFile ? String(summary.followersInFile) : followers}
                    disabled={Boolean(summary.followersInFile)}
                    onChange={(e) => setFollowers(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="e.g. 250000"
                  />
                </div>
                <div>
                  <span className="mb-6 block text-body-sm font-medium text-ink-muted">Timezone for timing analysis</span>
                  <Select
                    label="Timezone for timing analysis"
                    value={timezone}
                    icon={<Globe className="h-16 w-16" />}
                    options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))}
                    onChange={(v) => {
                      setTimezone(v);
                      void read(file, v, handle, span === 'custom' ? { start, end } : null);
                    }}
                    menuWidth={280}
                  />
                </div>
              </div>

              <label className="mt-16 flex cursor-pointer items-start gap-12 text-body-sm text-ink-muted">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-2 h-18 w-18 shrink-0 accent-[#a078ff]" />
                <span>
                  I confirm this data is from a public Instagram account and was collected in line with Instagram’s and Apify’s terms and the law. I understand it will be sent to Anthropic for analysis.
                </span>
              </label>

              <Button type="button" size="lg" loading={loading} onClick={() => void submit()} className="mt-20 h-52 w-full sm:w-auto sm:px-28">
                {!loading && <Sparkles className="h-18 w-18" aria-hidden />}
                {loading ? 'Starting…' : 'Analyse and build report'}
              </Button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-16">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <p className="mt-12 text-body-sm text-ink-subtle md:text-center">
        The file is read in memory and not stored · commenter details are ignored · no Apify credit is used
      </p>
    </div>
  );
}
