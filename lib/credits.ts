import 'server-only';
import { env } from '@/lib/env';
import { loadSecrets } from '@/lib/secrets';

// Live checks against the providers. Apify exposes the account's monthly usage
// and limit; Anthropic has no balance endpoint for ordinary API keys, so its
// credit is tracked from the cost of each report against a budget the team sets.

export const checkApifyToken = async (token: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const res = await fetch('https://api.apify.com/v2/users/me', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return { ok: true };
    return { ok: false, message: res.status === 401 ? 'Apify rejected this token. Copy it again from Apify Console → Settings → API & Integrations.' : `Apify returned an error (${res.status}).` };
  } catch {
    return { ok: false, message: 'Could not reach Apify to check the token. Try again.' };
  }
};

export const checkAnthropicKey = async (key: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: res.status === 401 ? 'Anthropic rejected this key. Create a new one at console.anthropic.com → API keys.' : `Anthropic returned an error (${res.status}).` };
  } catch {
    return { ok: false, message: 'Could not reach Anthropic to check the key. Try again.' };
  }
};

export interface ApifyUsage {
  usedUsd: number;
  limitUsd: number | null;
  cycleEnds: string | null;
}

export const apifyUsage = async (): Promise<ApifyUsage | null> => {
  try {
    await loadSecrets();
    const res = await fetch('https://api.apify.com/v2/users/me/limits', {
      headers: { Authorization: `Bearer ${env.apifyToken}` },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    const limit = Number(data?.limits?.maxMonthlyUsageUsd);
    return {
      usedUsd: Number(data?.current?.monthlyUsageUsd ?? 0),
      limitUsd: Number.isFinite(limit) && limit > 0 ? limit : null,
      cycleEnds: data?.monthlyUsageCycle?.endAt ?? null,
    };
  } catch {
    return null;
  }
};

// What InstaReport itself has spent this calendar month, from each report's recorded cost.
export const measuredSpend = async (since?: string | null) => {
  const { adminDb } = await import('@/lib/supabase/admin');
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const from = since && since < monthStart.toISOString() ? since : monthStart.toISOString();
  const { data } = await adminDb().from('reports').select('cost, created_at').gte('created_at', from);
  let apify = 0;
  let claude = 0;
  let claudeSince = 0;
  for (const r of data ?? []) {
    const inMonth = r.created_at >= monthStart.toISOString();
    if (inMonth) {
      apify += r.cost?.apifyUsd ?? 0;
      claude += r.cost?.claudeUsd ?? 0;
    }
    if (since && r.created_at >= since) claudeSince += r.cost?.claudeUsd ?? 0;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { apify: round(apify), claude: round(claude), claudeSince: round(claudeSince) };
};
