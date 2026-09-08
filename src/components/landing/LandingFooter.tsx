'use client';

import React from 'react';
import Link from 'next/link';
import { Terminal } from 'lucide-react';

function GithubIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800/90 bg-zinc-950/95 text-zinc-400 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Column (Span 2 on md) */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/80 flex items-center justify-center font-black text-white text-base shadow-lg shadow-black/40 select-none">
                S
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 tracking-tight text-base">Shipshape</span>
                <span className="text-[10px] text-zinc-300 font-mono uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                  v2.0 Beta
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm leading-relaxed">
              Shipshape plans architecture, generates typed multi-file Next.js codebases, executes in sandboxes, and automatically repairs build errors. Every change is an inspectable diff.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-xs text-zinc-300 font-mono">
                All Systems Operational • Turbopack Engine Active
              </span>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Product
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/applications" className="hover:text-white transition">
                  Start building
                </Link>
              </li>
              <li>
                <Link href="/projects" className="hover:text-white transition">
                  Projects Workspace
                </Link>
              </li>
              <li>
                <a href="#architecture" className="hover:text-white transition">
                  Architecture & Bento
                </a>
              </li>
              <li>
                <a href="#compare" className="hover:text-white transition">
                  How It Differs
                </a>
              </li>
              <li>
                <a href="#blueprints" className="hover:text-white transition">
                  Curated Blueprints
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Engineering */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Engineering
            </div>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-center gap-1.5 hover:text-white transition">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>Next.js 16 App Router</span>
              </li>
              <li className="hover:text-white transition">Turbopack Sandboxing</li>
              <li className="hover:text-white transition">AST Error Diagnostic Loop</li>
              <li className="hover:text-white transition">3-Attempt Self-Repair</li>
              <li className="hover:text-white transition">Zero-Lockin .zip Engine</li>
            </ul>
          </div>

          {/* Column 3: Trust & Resources */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Trust & Legal
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#security" className="hover:text-white transition">
                  Security Protocol
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition">
                  FAQ & Support
                </a>
              </li>
              <li>
                <span className="text-zinc-500">MIT Open Source License</span>
              </li>
              <li>
                <span className="text-zinc-500">Privacy & Local Storage</span>
              </li>
              <li>
                <span className="text-zinc-500">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>© 2026 Shipshape - End to End Application Builder.</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Built for developers who demand real code.</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a href="#faq" className="hover:text-white transition">
              Docs
            </a>
            <a href="#pricing" className="hover:text-white transition">
              Beta Status
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
