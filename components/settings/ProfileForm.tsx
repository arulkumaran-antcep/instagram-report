'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Notice, inputClass } from '@/components/ui';

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setStatus({ tone: 'danger', text: data.error ?? 'Could not save.' });
    setStatus({ tone: 'success', text: 'Saved.' });
    router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-16">
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Field label="Full name">
        <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Button type="submit" loading={busy} disabled={!name.trim() || name.trim() === initialName}>
        Save profile
      </Button>
    </form>
  );
}
