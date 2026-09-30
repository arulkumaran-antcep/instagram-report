'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, Trash2, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Field, Notice, cx, inputClass } from '@/components/ui';
import { Select } from '@/components/Select';

const ROLE_OPTIONS: { value: 'admin' | 'member'; label: string; hint: string }[] = [
  { value: 'member', label: 'Member', hint: 'Generate, view and download reports' },
  { value: 'admin', label: 'Admin', hint: 'Also manage the team' },
];
import { fmtDate } from '@/lib/format';

export type TeamMember = { userId: string; email: string; fullName: string; role: 'admin' | 'member'; createdAt: string };

function OneTimePassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Notice tone="success" title={`Temporary password for ${email}`}>
      <p>Share it privately (not by email together with the address). It is shown only once; they will choose their own password when they sign in.</p>
      <div className="mt-12 flex flex-wrap items-center gap-8">
        <code className="tabular rounded-md bg-canvas-deep px-12 py-8 text-body-lg font-semibold tracking-wide text-ink">{password}</code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
        >
          <Copy className="h-14 w-14" aria-hidden /> {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Notice>
  );
}

export function TeamManager({ members, currentUserId, isAdmin }: { members: TeamMember[]; currentUserId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'member' as 'admin' | 'member' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const call = async (key: string, url: string, method: string, body?: object) => {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return null;
    }
    router.refresh();
    return data;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call('add', '/api/team', 'POST', form);
    if (data) {
      setIssued({ email: form.email.trim().toLowerCase(), password: data.temporaryPassword });
      setForm({ fullName: '', email: '', role: 'member' });
      setAdding(false);
    }
  };

  return (
    <div className="p-20 md:p-24">
      {error && (
        <div className="mb-16">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {issued && (
        <div className="mb-16">
          <OneTimePassword email={issued.email} password={issued.password} onClose={() => setIssued(null)} />
        </div>
      )}

      <ul className="divide-y divide-line rounded-xl border border-line">
        {members.map((m) => {
          const self = m.userId === currentUserId;
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-12 px-16 py-12">
              <Avatar name={m.fullName || m.email} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-semibold text-ink">
                  {m.fullName || m.email} {self && <span className="font-normal text-ink-subtle">(you)</span>}
                </p>
                <p className="truncate text-body-sm text-ink-subtle">
                  {m.email} · added {fmtDate(m.createdAt)}
                </p>
              </div>
              {isAdmin && !self ? (
                <div className="flex items-center gap-4">
                  <div className="w-120">
                    <Select
                      label={`Role for ${m.email}`}
                      size="sm"
                      value={m.role}
                      disabled={busy !== null}
                      options={ROLE_OPTIONS}
                      menuWidth={260}
                      onChange={(role) => void call(`role-${m.userId}`, `/api/team/${m.userId}`, 'PATCH', { role })}
                    />
                  </div>
                  <button
                    type="button"
                    title="Reset password"
                    aria-label={`Reset password for ${m.email}`}
                    disabled={busy !== null}
                    onClick={async () => {
                      if (!window.confirm(`Reset the password for ${m.email}? They will need the new temporary password to sign in.`)) return;
                      const data = await call(`reset-${m.userId}`, `/api/team/${m.userId}`, 'PATCH', { action: 'reset-password' });
                      if (data) setIssued({ email: m.email, password: data.temporaryPassword });
                    }}
                    className="flex h-32 w-32 items-center justify-center rounded-md text-ink-muted hover:bg-surface-high hover:text-ink"
                  >
                    <KeyRound className="h-16 w-16" />
                  </button>
                  <button
                    type="button"
                    title="Remove from team"
                    aria-label={`Remove ${m.email}`}
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm(`Remove ${m.email} from the team? They are signed out immediately. Their reports stay.`)) {
                        void call(`del-${m.userId}`, `/api/team/${m.userId}`, 'DELETE');
                      }
                    }}
                    className="flex h-32 w-32 items-center justify-center rounded-md text-ink-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-16 w-16" />
                  </button>
                </div>
              ) : (
                <Badge tone={m.role === 'admin' ? 'primary' : 'neutral'} className="capitalize">
                  {m.role}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin &&
        (adding ? (
          <form onSubmit={add} className="mt-16 grid grid-cols-1 gap-16 rounded-xl border border-line bg-surface-low p-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto] md:items-end">
            <Field label="Full name">
              <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={80} />
            </Field>
            <Field label="Work email">
              <input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <div>
              <span className="mb-6 block text-body-sm font-medium text-ink-muted">Role</span>
              <Select label="Role" value={form.role} options={ROLE_OPTIONS} menuWidth={260} onChange={(role) => setForm({ ...form, role })} />
            </div>
            <div className="flex gap-8">
              <Button type="submit" loading={busy === 'add'} disabled={!form.fullName.trim() || !form.email.trim()}>
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" className={cx('mt-16')} onClick={() => setAdding(true)}>
            <UserPlus className="h-16 w-16" aria-hidden /> Add teammate
          </Button>
        ))}

      <p className="mt-16 text-body-sm text-ink-subtle">
        Members can generate, view and download reports and delete their own. Admins can also manage the team and delete any report.
      </p>
    </div>
  );
}
