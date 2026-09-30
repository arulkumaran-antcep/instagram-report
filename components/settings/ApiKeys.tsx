'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Badge, Button, Field, Notice, cx, inputClass } from '@/components/ui';
import { fmtDate, fmtUsd } from '@/lib/format';

type KeyStatus = { source: 'settings' | 'server' | 'none'; last4: string | null; updatedBy: string | null; updatedAt: string | null };
type Data = {
  keys: { apify_token: KeyStatus; anthropic_key: KeyStatus };
  budgets: { anthropic: number | null; anthropicSince: string | null };
  spend: { apify: number; claude: number; claudeSince: number };
  apifyUsage: { usedUsd: number; limitUsd: number | null; cycleEnds: string | null } | null;
};

const call = async (method: string, body?: unknown) => {
  const res = await fetch('/api/settings/keys', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
};

function Meter({ used, total, label }: { used: number; total: number; label: string }) {
  const left = Math.max(0, total - used);
  const pct = Math.min(100, (used / total) * 100);
  const tone = left / total < 0.1 ? 'bg-danger' : left / total < 0.25 ? 'bg-warning' : 'bg-success';
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-body-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="tabular text-body-md font-semibold text-ink">{fmtUsd(left)} left</span>
      </div>
      <div className="mt-8 h-8 overflow-hidden rounded-full bg-canvas-deep" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
        <div className={cx('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <p className="tabular mt-8 text-body-sm text-ink-subtle">
        {fmtUsd(used)} used of {fmtUsd(total)}
      </p>
    </div>
  );
}

function KeyRow({
  title,
  purpose,
  name,
  status,
  placeholder,
  fieldHint,
  consoleUrl,
  onDone,
  children,
}: {
  title: string;
  purpose: string;
  name: 'apify_token' | 'anthropic_key';
  status: KeyStatus;
  placeholder: string;
  fieldHint: string;
  consoleUrl: string;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setValue('');
      setMsg({ tone: 'success', text: ok });
      onDone();
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
    setBusy(false);
  };

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface-low p-16 md:p-20">
      <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-8">
        <div className="min-w-0">
          <h3 className="text-body-lg font-semibold text-ink">{title}</h3>
          <p className="mt-2 text-body-sm text-ink-subtle">{purpose}</p>
        </div>
        {status.source === 'none' ? (
          <Badge tone="danger">Not set</Badge>
        ) : (
          <Badge tone="success">
            {status.source === 'settings' ? 'Saved here' : 'Server setting'} · ends {status.last4}
          </Badge>
        )}
      </div>
      {status.source === 'settings' && status.updatedAt && (
        <p className="mt-8 text-body-sm text-ink-subtle">
          Updated {fmtDate(status.updatedAt)} by {status.updatedBy ?? 'an admin'}
        </p>
      )}

      <div className="mt-16 border-t border-line pt-16">{children}</div>

      <form
        className="mt-20 border-t border-line pt-16"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => call('PUT', { name, value }), 'Key checked with the provider and saved. New reports use it straight away.');
        }}
      >
        <Field label={`Replace the ${title} key`} hint={fieldHint}>
          <input type="password" autoComplete="off" spellCheck={false} className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        </Field>
        <Button type="submit" loading={busy} disabled={!value.trim()} className="mt-12 w-full sm:w-auto">
          Check & save
        </Button>
      </form>
      <div className="mt-16 flex flex-wrap items-center gap-x-16 gap-y-8 text-body-sm">
        <a href={consoleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-4 text-primary hover:underline">
          Open provider console <ExternalLink className="h-12 w-12" aria-hidden />
        </a>
        {status.source === 'settings' && (
          <button type="button" className="text-ink-subtle hover:text-ink hover:underline" onClick={() => void run(() => call('DELETE', { name }), 'Removed. The server’s own setting is used again.')}>
            Remove and use the server setting
          </button>
        )}
      </div>
      {msg && (
        <div className="mt-12">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}

export function ApiKeys() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await call('GET'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <div className="p-16 md:p-24">
        <Notice tone="danger">{error}</Notice>
      </div>
    );
  if (!data)
    return (
      <div className="flex items-center gap-8 p-16 text-body-md text-ink-subtle md:p-24">
        <Loader2 className="h-16 w-16 animate-spin" aria-hidden /> Checking your accounts…
      </div>
    );

  const { budgets, spend, apifyUsage } = data;

  return (
    <div className="grid grid-cols-1 items-stretch gap-16 p-12 sm:p-16 md:gap-24 md:p-24 lg:grid-cols-2">
      <KeyRow
        title="Apify"
        purpose="Collects the Instagram posts and profile details."
        name="apify_token"
        status={data.keys.apify_token}
        placeholder="apify_api_…"
        fieldHint="Paste a new token from Apify Console → Settings → API & Integrations. It is checked before saving."
        consoleUrl="https://console.apify.com/settings/integrations"
        onDone={load}
      >
        {apifyUsage ? (
          apifyUsage.limitUsd ? (
            <>
              <Meter used={apifyUsage.usedUsd} total={apifyUsage.limitUsd} label="Usage this billing cycle" />
              {apifyUsage.cycleEnds && <p className="mt-4 text-body-sm text-ink-subtle">Resets {fmtDate(apifyUsage.cycleEnds)}. Read live from Apify.</p>}
            </>
          ) : (
            <p className="text-body-md text-ink-muted">{fmtUsd(apifyUsage.usedUsd)} used this cycle. Apify reports no limit for this account.</p>
          )
        ) : (
          <p className="text-body-md text-ink-subtle">Usage couldn’t be read. Check that the token is valid.</p>
        )}
      </KeyRow>

      <KeyRow
        title="Anthropic"
        purpose="Claude categorises the posts and writes the analysis."
        name="anthropic_key"
        status={data.keys.anthropic_key}
        placeholder="sk-ant-…"
        fieldHint="Create a key at console.anthropic.com → API keys and paste it here. It is checked before saving."
        consoleUrl="https://console.anthropic.com/settings/billing"
        onDone={load}
      >
        {budgets.anthropic != null ? (
          <Meter used={Math.max(0, spend.claudeSince)} total={Math.max(budgets.anthropic, 0.01)} label="Estimated credit" />
        ) : (
          <p className="text-body-md text-ink-muted">Anthropic doesn’t share your balance with apps. Enter it below and InstaReport will subtract what each report costs.</p>
        )}
        <form
          className="mt-16"
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingBalance(true);
            try {
              await call('PUT', { budgets: { anthropic: balance } });
              setBalance('');
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save.');
            }
            setSavingBalance(false);
          }}
        >
          <Field label="Credit balance right now (USD)" hint="Copy it from console.anthropic.com → Billing after each top-up. InstaReport subtracts each report’s cost from it.">
            <input inputMode="decimal" className={inputClass} value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 25.00" />
          </Field>
          <Button type="submit" variant="secondary" loading={savingBalance} disabled={!balance} className="mt-12 w-full sm:w-auto">
            Set balance
          </Button>
        </form>
        <p className="mt-12 text-body-sm text-ink-subtle">This month InstaReport has used {fmtUsd(spend.claude)} of Claude.</p>
      </KeyRow>
    </div>
  );
}
