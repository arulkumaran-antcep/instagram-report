'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-48 max-w-560 p-32 text-center">
      <AlertCircle className="mx-auto h-32 w-32 text-danger" aria-hidden />
      <h1 className="mt-12 text-headline-sm text-ink">This page couldn’t load</h1>
      <p className="mt-6 text-body-md text-ink-subtle">Check your connection and try again. If it keeps happening, tell an admin.</p>
      <Button className="mt-20" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
