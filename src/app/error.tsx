'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ui/ErrorState';

/**
 * Route-level fallback for rendering errors. Server errors arrive with a
 * `digest` that matches the server log line (see instrumentation.ts), so it is
 * shown as a reference rather than the message, which may hold internals.
 */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : undefined;

  useEffect(() => {
    console.error('Unhandled UI error', digest ?? error);
  }, [error, digest]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <ErrorState
        title="This page hit a problem"
        message={digest ? `Please try again. If it keeps happening, quote reference ${digest}.` : 'Please try again.'}
        onRetry={retry}
      />
    </div>
  );
}
