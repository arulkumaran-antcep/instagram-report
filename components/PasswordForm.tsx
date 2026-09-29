'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { Button, Field, Notice, cx, inputClass } from '@/components/ui';

const rules = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'A letter and a number', test: (p: string) => /[a-z]/i.test(p) && /\d/.test(p) },
];

export function PasswordForm({ mode }: { mode: 'first-time' | 'change' }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid = rules.every((r) => r.test(password)) && password === confirm && (mode === 'first-time' || current.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setLoading(true);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, currentPassword: current }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? 'Could not update the password.');
      return;
    }
    if (mode === 'first-time') {
      // Pick up the cleared "must change password" flag in the session.
      await browserClient().auth.refreshSession();
      window.location.assign('/');
      return;
    }
    setLoading(false);
    setDone(true);
    setCurrent('');
    setPassword('');
    setConfirm('');
  };

  return (
    <form onSubmit={submit} className="space-y-16" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      {done && <Notice tone="success">Password updated.</Notice>}
      {mode === 'change' && (
        <Field label="Current password">
          <input className={inputClass} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
      )}
      <Field label="New password">
        <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <ul className="space-y-4" aria-label="Password requirements">
        {rules.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.label} className={cx('flex items-center gap-8 text-body-sm', ok ? 'text-success' : 'text-ink-subtle')}>
              {ok ? <Check className="h-14 w-14" aria-hidden /> : <X className="h-14 w-14" aria-hidden />} {r.label}
            </li>
          );
        })}
      </ul>
      <Field label="Confirm new password" error={confirm && confirm !== password ? 'Passwords don’t match.' : null}>
        <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" size={mode === 'first-time' ? 'lg' : 'md'} className={mode === 'first-time' ? 'w-full' : ''} loading={loading} disabled={!valid}>
        {mode === 'first-time' ? 'Save password and continue' : 'Update password'}
      </Button>
    </form>
  );
}
