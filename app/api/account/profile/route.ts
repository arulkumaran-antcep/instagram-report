import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';

export async function PATCH(request: Request) {
  try {
    const member = await requireApiMember(request);
    const body = await request.json().catch(() => ({}));
    const fullName = String(body.fullName ?? '').trim().slice(0, 80);
    if (!fullName) throw new HttpError(400, 'Enter your name.');
    const { error } = await adminDb().from('members').update({ full_name: fullName }).eq('user_id', member.userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
