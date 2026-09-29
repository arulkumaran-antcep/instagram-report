import { createClient } from '@supabase/supabase-js';
import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { passwordProblem } from '@/lib/passwords';

// Sets a new password. First-time setup (after an admin created the account)
// skips the current-password check; every later change requires it.
export async function POST(request: Request) {
  try {
    const member = await requireApiMember(request, { allowPendingPassword: true });
    const body = await request.json().catch(() => ({}));
    const password = String(body.password ?? '');
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);

    if (!member.mustChangePassword) {
      const verifier = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await verifier.auth.signInWithPassword({ email: member.email, password: String(body.currentPassword ?? '') });
      if (error) throw new HttpError(400, 'Your current password is incorrect.');
      await verifier.auth.signOut({ scope: 'local' });
    }

    const { error } = await adminDb().auth.admin.updateUserById(member.userId, {
      password,
      app_metadata: { must_change_password: false },
    });
    if (error) throw new HttpError(400, /same/i.test(error.message) ? 'Choose a password different from the current one.' : 'Could not update the password.');
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
