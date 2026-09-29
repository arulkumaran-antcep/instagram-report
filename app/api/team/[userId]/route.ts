import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { temporaryPassword } from '@/lib/passwords';

const adminCount = async () => {
  const { count } = await adminDb().from('members').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
  return count ?? 0;
};

const findMember = async (userId: string) => {
  const { data } = await adminDb().from('members').select('user_id, role, email').eq('user_id', userId).maybeSingle();
  if (!data) throw new HttpError(404, 'Team member not found.');
  return data;
};

// Change role, or reset a forgotten password.
export async function PATCH(request: Request, ctx: RouteContext<'/api/team/[userId]'>) {
  try {
    const me = await requireApiMember(request, { admin: true });
    const { userId } = await ctx.params;
    const target = await findMember(userId);
    const body = await request.json().catch(() => ({}));

    if (body.action === 'reset-password') {
      const password = temporaryPassword();
      const { error } = await adminDb().auth.admin.updateUserById(userId, {
        password,
        app_metadata: { must_change_password: true },
      });
      if (error) throw error;
      return Response.json({ ok: true, temporaryPassword: password });
    }

    const role = body.role === 'admin' ? 'admin' : body.role === 'member' ? 'member' : null;
    if (!role) throw new HttpError(400, 'Unknown change.');
    if (target.role === 'admin' && role === 'member' && (await adminCount()) <= 1) {
      throw new HttpError(409, 'The team needs at least one admin.');
    }
    if (userId === me.userId && role === 'member') throw new HttpError(409, 'Ask another admin to change your role.');
    const { error } = await adminDb().from('members').update({ role }).eq('user_id', userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/team/[userId]'>) {
  try {
    const me = await requireApiMember(request, { admin: true });
    const { userId } = await ctx.params;
    if (userId === me.userId) throw new HttpError(409, 'You can’t remove yourself.');
    const target = await findMember(userId);
    if (target.role === 'admin' && (await adminCount()) <= 1) throw new HttpError(409, 'The team needs at least one admin.');
    // Deleting the auth user signs them out everywhere and removes the
    // members row (cascade). Their reports stay, attributed by name.
    const { error } = await adminDb().auth.admin.deleteUser(userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
