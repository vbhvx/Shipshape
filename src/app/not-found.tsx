import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="p-10 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-3">
        <p className="text-xs font-mono text-zinc-500">404</p>
        <h1 className="text-base font-bold text-zinc-100">Page not found</h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">The page you asked for does not exist or has moved.</p>
        <Link
          href="/projects"
          className="inline-block px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
        >
          Go to your projects
        </Link>
      </div>
    </div>
  );
}
