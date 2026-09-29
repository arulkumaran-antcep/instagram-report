import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/supabase/admin';
import { sessionClient } from '@/lib/supabase/server';

export type Role = 'admin' | 'member';

export interface Member {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

// Verifies the session with Supabase (not just the cookie) and checks the
// user is on the team. Cached per request.
export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await adminDb()
    .from('members')
    .select('email, full_name, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    userId: user.id,
    email: data.email,
    fullName: data.full_name || data.email,
    role: data.role,
    mustChangePassword: user.app_metadata?.must_change_password === true,
  };
});

export const requireMember = async (): Promise<Member> => {
  const member = await getMember();
  if (!member) redirect('/login');
  if (member.mustChangePassword) redirect('/set-password');
  return member;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// For route handlers. Mutating requests must come from our own origin.
export const requireApiMember = async (
  request: Request,
  { admin = false, allowPendingPassword = false } = {},
): Promise<Member> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    const h = await headers();
    const host = h.get('x-forwarded-host')?.split(',')[0].trim() || h.get('host');
    if (!origin || new URL(origin).host !== host) {
      throw new HttpError(403, 'Request blocked: unexpected origin.');
    }
  }
  const member = await getMember();
  if (!member) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  if (member.mustChangePassword && !allowPendingPassword) {
    throw new HttpError(403, 'Please set a new password first.');
  }
  if (admin && member.role !== 'admin') throw new HttpError(403, 'Only admins can do this.');
  return member;
};

export const apiError = (error: unknown): Response => {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('[api]', error);
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
};
