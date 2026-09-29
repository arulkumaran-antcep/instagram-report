'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { Button, Field, Notice, inputClass } from '@/components/ui';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await browserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setLoading(false);
      setError(
        /rate|too many/i.test(signInError.message)
          ? 'Too many attempts. Wait a few minutes and try again.'
          : 'That email and password don’t match. Check them and try again.',
      );
      return;
    }
    // Full navigation so the server sees the new session cookie.
    window.location.assign(next);
  };

  return (
    <form onSubmit={submit} className="space-y-16" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Work email">
        <input
          className={inputClass}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </Field>
      <Field label="Password">
        <div className="relative">
          <input
            className={`${inputClass} pr-48`}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-4 top-1/2 flex h-36 w-36 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle hover:text-ink"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="h-18 w-18" /> : <Eye className="h-18 w-18" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
        Sign in
      </Button>
      <p className="text-center text-body-sm text-ink-subtle">Forgot your password? Ask an admin to reset it from Settings → Team.</p>
    </form>
  );
}
