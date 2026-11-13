'use client';

import './globals.css';
import ErrorState from '@/components/ui/ErrorState';

/** Last-resort fallback when the root layout itself fails; it replaces the layout, so it renders its own document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : undefined;

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <ErrorState
          title="Shipshape could not load"
          message={digest ? `Please try again. If it keeps happening, quote reference ${digest}.` : 'Please try again.'}
          onRetry={retry}
        />
      </body>
    </html>
  );
}
