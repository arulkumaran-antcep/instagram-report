import Link from 'next/link';
import { buttonClass } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-16 text-center">
      <p className="label text-primary">404</p>
      <h1 className="mt-8 text-headline-lg text-ink">Page not found</h1>
      <p className="mt-8 max-w-420 text-body-lg text-ink-subtle">The report may have been deleted, or the link is incomplete.</p>
      <Link href="/" className={buttonClass('primary', 'md', 'mt-24')}>
        Back to dashboard
      </Link>
    </div>
  );
}
