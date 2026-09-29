import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMember } from '@/lib/auth';
import { AuthFrame } from '@/components/AuthFrame';
import { PasswordForm } from '@/components/PasswordForm';

export const metadata: Metadata = { title: 'Set your password' };

export default async function SetPasswordPage() {
  const member = await getMember();
  if (!member) redirect('/login');
  if (!member.mustChangePassword) redirect('/');
  return (
    <AuthFrame title={`Welcome, ${member.fullName.split(' ')[0]}`} subtitle="Choose your own password to finish setting up your account.">
      <PasswordForm mode="first-time" />
    </AuthFrame>
  );
}
