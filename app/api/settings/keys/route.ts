import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { apifyUsage, checkAnthropicKey, checkApifyToken, measuredSpend } from '@/lib/credits';
import { getBudgets, removeSecret, saveSecret, secretStatus, setBudgets, type SecretName } from '@/lib/secrets';

const NAMES: SecretName[] = ['apify_token', 'anthropic_key'];
const asName = (v: unknown): SecretName => {
  if (!NAMES.includes(v as SecretName)) throw new HttpError(400, 'Unknown key.');
  return v as SecretName;
};

export async function GET(request: Request) {
  try {
    await requireApiMember(request, { admin: true });
    const budgets = await getBudgets();
    const [apify, anthropic, spend, usage] = await Promise.all([
      secretStatus('apify_token'),
      secretStatus('anthropic_key'),
      measuredSpend(budgets.anthropicSince),
      apifyUsage(),
    ]);
    return Response.json({ keys: { apify_token: apify, anthropic_key: anthropic }, budgets, spend, apifyUsage: usage });
  } catch (error) {
    return apiError(error);
  }
}

// Body: { name, value } saves a key after checking it works with the provider;
// { budgets: { apify, anthropic } } saves the monthly budgets.
export async function PUT(request: Request) {
  try {
    const member = await requireApiMember(request, { admin: true });
    const body = await request.json().catch(() => ({}));

    if (body.budgets) {
      const v = body.budgets.anthropic;
      if (v === null || v === '' || v === undefined) {
        await setBudgets({ anthropic: null, anthropicSince: null });
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 100_000) throw new HttpError(400, 'Enter a credit balance between 0 and 100,000 USD.');
        await setBudgets({ anthropic: Math.round(n * 100) / 100, anthropicSince: new Date().toISOString() });
      }
      return Response.json({ ok: true });
    }

    const name = asName(body.name);
    const value = String(body.value ?? '').trim();
    if (value.length < 20 || value.length > 300 || /\s/.test(value)) throw new HttpError(400, 'That doesn’t look like a complete key. Paste it exactly as shown by the provider.');
    if (name === 'anthropic_key' && !value.startsWith('sk-ant-')) throw new HttpError(400, 'Anthropic keys start with sk-ant-. Check you pasted the right one.');
    if (name === 'apify_token' && !value.startsWith('apify_api_')) throw new HttpError(400, 'Apify tokens start with apify_api_. Check you pasted the right one.');

    const check = name === 'apify_token' ? await checkApifyToken(value) : await checkAnthropicKey(value);
    if (!check.ok) throw new HttpError(400, check.message ?? 'The key could not be verified.');

    await saveSecret(name, value, member.fullName);
    return Response.json({ ok: true, last4: value.slice(-4) });
  } catch (error) {
    return apiError(error);
  }
}

// Removes the key saved in Settings so the server's environment variable is used again.
export async function DELETE(request: Request) {
  try {
    await requireApiMember(request, { admin: true });
    const body = await request.json().catch(() => ({}));
    await removeSecret(asName(body.name));
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
