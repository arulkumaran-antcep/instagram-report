import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { temporaryPassword } from '@/lib/passwords';

// Admin adds a teammate. They get a one-time password to share privately and
// must choose their own password when they first sign in.
export async function POST(request: Request) {
  try {
    await requireApiMember(request, { admin: true });
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim().slice(0, 80);
    const role = body.role === 'admin' ? 'admin' : 'member';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (!fullName) throw new HttpError(400, 'Enter the person’s name.');

    const db = adminDb();
    const { data: existing } = await db.from('members').select('user_id').eq('email', email).maybeSingle();
    if (existing) throw new HttpError(409, 'This person is already on the team.');

    const password = temporaryPassword();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { must_change_password: true },
    });
    if (error || !data.user) {
      throw new HttpError(400, /already/i.test(error?.message ?? '') ? 'An account with this email already exists.' : 'Could not create the account.');
    }

    const { error: insertError } = await db.from('members').insert({ user_id: data.user.id, email, full_name: fullName, role });
    if (insertError) {
      await db.auth.admin.deleteUser(data.user.id);
      throw insertError;
    }
    return Response.json({ ok: true, temporaryPassword: password }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
