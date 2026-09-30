import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';

export type SecretName = 'apify_token' | 'anthropic_key';
export const SECRET_ENV: Record<SecretName, string> = { apify_token: 'APIFY_API_TOKEN', anthropic_key: 'ANTHROPIC_API_KEY' };

// Encrypts with AES-256-GCM. APP_ENCRYPTION_KEY is used if set; otherwise the
// key is derived from the Supabase service-role key, so a leaked database
// export alone can't be decrypted.
const cipherKey = () =>
  createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY || `instareport:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`)
    .digest();

export const encrypt = (plain: string) => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
};

export const decrypt = (payload: string) => {
  const raw = Buffer.from(payload, 'base64');
  const d = createDecipheriv('aes-256-gcm', cipherKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
};

// Keys saved in Settings win over the server's environment variables. They are
// loaded at the start of each report and cached briefly.
const cache = new Map<SecretName, string>();
let loadedAt = 0;

export const loadSecrets = async (force = false) => {
  if (!force && Date.now() - loadedAt < 30_000) return;
  const { data, error } = await adminDb().from('app_secrets').select('name, ciphertext');
  if (error) return; // table missing or unreachable: fall back to environment variables
  cache.clear();
  for (const row of data ?? []) {
    try {
      cache.set(row.name as SecretName, decrypt(row.ciphertext));
    } catch {
      // wrong encryption key or corrupt row: ignore so the env fallback still works
    }
  }
  loadedAt = Date.now();
};

export const secretOverride = (name: SecretName) => cache.get(name);

export const saveSecret = async (name: SecretName, value: string, by: string) => {
  const { error } = await adminDb()
    .from('app_secrets')
    .upsert({ name, ciphertext: encrypt(value), last4: value.slice(-4), updated_by: by, updated_at: new Date().toISOString() });
  if (error) throw error;
  await loadSecrets(true);
};

export const removeSecret = async (name: SecretName) => {
  const { error } = await adminDb().from('app_secrets').delete().eq('name', name);
  if (error) throw error;
  await loadSecrets(true);
};

export const secretStatus = async (name: SecretName) => {
  const { data } = await adminDb().from('app_secrets').select('last4, updated_by, updated_at').eq('name', name).maybeSingle();
  const envValue = process.env[SECRET_ENV[name]];
  const envSet = Boolean(envValue && !envValue.startsWith('your_'));
  return {
    source: data ? ('settings' as const) : envSet ? ('server' as const) : ('none' as const),
    last4: data?.last4 ?? (envSet ? envValue!.slice(-4) : null),
    updatedBy: data?.updated_by ?? null,
    updatedAt: data?.updated_at ?? null,
  };
};

// Monthly budgets (USD) that the team sets so spend can be tracked.
// anthropic = credit balance the admin last entered; anthropicSince = when they entered it,
// so remaining credit = balance - cost of reports created since then.
export type Budgets = { anthropic: number | null; anthropicSince: string | null };

export const getBudgets = async (): Promise<Budgets> => {
  const { data } = await adminDb().from('app_settings').select('value').eq('key', 'budgets').maybeSingle();
  const v = (data?.value ?? {}) as Partial<Budgets>;
  return { anthropic: v.anthropic ?? null, anthropicSince: v.anthropicSince ?? null };
};

export const setBudgets = async (budgets: Budgets) => {
  const { error } = await adminDb().from('app_settings').upsert({ key: 'budgets', value: budgets, updated_at: new Date().toISOString() });
  if (error) throw error;
};
