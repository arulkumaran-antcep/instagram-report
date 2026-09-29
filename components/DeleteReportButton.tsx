'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';

export function DeleteReportButton({ id, handle, redirectTo }: { id: string; handle: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!window.confirm(`Delete the report for @${handle}? The PDF and Excel files are removed too. This can't be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? 'Could not delete the report.');
      setBusy(false);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="flex h-36 w-36 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      aria-label={`Delete report for @${handle}`}
      title="Delete"
    >
      {busy ? <Loader2 className="h-18 w-18 animate-spin" /> : <Trash2 className="h-18 w-18" />}
    </button>
  );
}
