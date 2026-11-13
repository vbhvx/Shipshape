import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  /** Shown as the button when the failed action can be retried. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** The app's one failure block: what failed, why, and how to recover. */
export default function ErrorState({ title, message, onRetry, retryLabel = 'Try again', className = '' }: ErrorStateProps) {
  return (
    <div role="alert" className={`p-10 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-3 ${className}`}>
      <AlertCircle className="w-8 h-8 mx-auto text-zinc-400" aria-hidden="true" />
      <h3 className="text-base font-bold text-zinc-100">{title}</h3>
      <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
