'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export default function PricingBetaSection() {
  const betaFeatures = [
    'Unlimited multi-file Next.js App Router synthesis',
    '3-attempt automated compiler & typecheck repair loop',
    'Dedicated isolated sandbox with live preview (port allocation)',
    'Line-by-line unified version diffs and one-click rollback',
    'Standalone .zip source export (standard package.json, MIT)',
    'Local database & file persistence with zero lock-in',
  ];

  const upcomingFeatures = [
    'One-click GitHub pull request synchronization',
    'Persistent cloud container hosting & custom domains',
    'Bring-your-own-keys (Anthropic Claude 3.7, GPT-4o, Ollama)',
    'Multiplayer team collaboration and workspace sharing',
  ];

  return (
    <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Transparent Pricing</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Free During Public Beta
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
          Experience unconstrained autonomous full-stack software development. No credit card required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Tier 1: Public Beta (Active) */}
        <div className="p-7 sm:p-8 rounded-3xl bg-zinc-900/90 border-2 border-emerald-500/80 shadow-2xl relative flex flex-col justify-between space-y-6">
          <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-400 text-black uppercase tracking-wider shadow-lg">
            Active Tier
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white">Public Beta Builder</h3>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1">
                Full-featured autonomous Next.js application synthesis with live execution.
              </p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white font-mono">$0</span>
              <span className="text-xs text-zinc-400 font-mono">/ free during beta</span>
            </div>

            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-zinc-200">
              {betaFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <Link
              href="/applications"
              className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold shadow-xl shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Start building for free</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </Link>
          </div>
        </div>

        {/* Tier 2: Pro & Teams (Roadmap) */}
        <div className="p-7 sm:p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 relative flex flex-col justify-between space-y-6 opacity-90">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-200">Pro & Teams</h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  For engineering teams requiring cloud deployment and enterprise integration.
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Coming Soon
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-400 font-mono">Roadmap</span>
              <span className="text-xs text-zinc-500 font-mono">/ upcoming tier</span>
            </div>

            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-zinc-400">
              {upcomingFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-zinc-800/80">
            <div className="text-xs text-center text-zinc-400 py-2">
              Everything in Public Beta plus continuous cloud sync
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
