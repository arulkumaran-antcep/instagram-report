'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { STAGES, type ReportStatus, type Stage } from '@/lib/report-types';
import { cx } from '@/components/ui';
import { RegenerateButton } from '@/components/report/RegenerateButton';

type Status = { status: ReportStatus; stage: Stage; progress: number; error: string | null };

const STEPS = STAGES.filter((s) => s.key !== 'queued' && s.key !== 'done');

export function ReportProgress({ id, handle, timezone, initial }: { id: string; handle: string; timezone: string; initial: Status }) {
  const router = useRouter();
  const [state, setState] = useState<Status>(initial);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());

  useEffect(() => {
    if (state.status === 'completed') {
      router.refresh();
      return;
    }
    if (state.status === 'failed') return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/reports/${id}`, { cache: 'no-store' });
      if (res.ok) setState(await res.json());
    }, 3000);
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [id, state.status, router]);

  if (state.status === 'failed') {
    return (
      <div className="card mx-auto max-w-720 p-24 md:p-32">
        <div className="flex items-start gap-14">
          <span className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
            <AlertCircle className="h-20 w-20" aria-hidden />
          </span>
          <div>
            <h2 className="text-headline-sm text-ink">The report for @{handle} couldn’t be generated</h2>
            <p className="mt-6 text-body-md text-ink-muted">{state.error ?? 'Something went wrong.'}</p>
            <div className="mt-20">
              <RegenerateButton handle={handle} timezone={timezone} label="Try again" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === state.stage);
  const minutes = Math.floor(elapsed / 60);

  return (
    <div className="card mx-auto max-w-720 p-24 md:p-32" aria-live="polite">
      <p className="label text-primary">Generating report</p>
      <h2 className="mt-8 text-headline-md text-ink">@{handle}</h2>
      <p className="mt-4 text-body-md text-ink-subtle">
        This usually takes 4–8 minutes. You can leave this page; the report keeps generating and will appear in Report History.
      </p>

      <div className="mt-24 h-8 w-full overflow-hidden rounded-full bg-surface-high" role="progressbar" aria-valuenow={state.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-8 rounded-full bg-brand-gradient transition-[width] duration-700" style={{ width: `${Math.max(3, state.progress)}%` }} />
      </div>
      <p className="tabular mt-8 text-body-sm text-ink-subtle">
        {state.progress}% · {minutes > 0 ? `${minutes} min ` : ''}
        {elapsed % 60}s on this page
      </p>

      <ol className="mt-24 space-y-12">
        {STEPS.map((s, i) => {
          const done = currentIndex > i;
          const active = currentIndex === i || (currentIndex === -1 && i === 0);
          return (
            <li key={s.key} className="flex items-center gap-12">
              <span
                className={cx(
                  'flex h-24 w-24 shrink-0 items-center justify-center rounded-full border',
                  done && 'border-success/40 bg-success/10 text-success',
                  active && 'border-primary/50 bg-primary/10 text-primary',
                  !done && !active && 'border-line-strong text-ink-faint',
                )}
              >
                {done ? <Check className="h-14 w-14" aria-hidden /> : active ? <Loader2 className="h-14 w-14 animate-spin" aria-hidden /> : <span className="text-label-sm">{i + 1}</span>}
              </span>
              <span className={cx('text-body-md', done ? 'text-ink-muted' : active ? 'font-semibold text-ink' : 'text-ink-faint')}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
