import type { Metadata } from 'next';
import { AuthFrame } from '@/components/AuthFrame';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <AuthFrame title="Sign in" subtitle="Use the email and password your admin gave you.">
      <LoginForm next={safeNext} />
    </AuthFrame>
  );
}
