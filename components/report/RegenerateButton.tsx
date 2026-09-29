'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

export function RegenerateButton({ handle, timezone, label = 'Regenerate', confirm }: { handle: string; timezone: string; label?: string; confirm?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, timezone, force: true }),
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
