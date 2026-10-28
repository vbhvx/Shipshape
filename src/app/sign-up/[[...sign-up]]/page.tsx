import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950/40 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-black bg-grid-crosshair relative">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Shipshape</span>
          </Link>

          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700 flex items-center justify-center font-black text-white text-sm shadow select-none">
              S
            </div>
            <span className="font-bold text-zinc-100 text-sm tracking-tight">Shipshape</span>
          </Link>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <Suspense fallback={<div className="h-96 w-96 animate-pulse rounded-2xl bg-zinc-900/50" />}>
          <SignUp />
        </Suspense>
      </main>
    </div>
  );
}
