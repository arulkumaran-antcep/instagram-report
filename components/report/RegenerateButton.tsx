'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

type Span = { id?: string; source?: string; window_months: number; window_start: string | null; window_end: string | null };

export function RegenerateButton({ handle, timezone, span, label = 'Regenerate', confirm }: { handle: string; timezone: string; span: Span; label?: string; confirm?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        span.source === 'upload'
          ? { fromReport: span.id }
          : {
              handle,
              timezone,
              force: true,
              ...(span.window_start && span.window_end
                ? { period: 'custom', start: span.window_start, end: span.window_end }
                : { period: `${span.window_months}m` }),
            },
      ),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error ?? 'Could not start a new report.');
      setBusy(false);
      return;
    }
    router.push(`/reports/${data.id}`);
  };

  return (
    <Button type="button" variant="secondary" onClick={run} loading={busy}>
      {!busy && <RefreshCw className="h-16 w-16" aria-hidden />}
      {label}
    </Button>
  );
}
