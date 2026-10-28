'use client';

import React from 'react';
import { Shield, Lock, EyeOff, FileCheck2 } from 'lucide-react';

export default function SecuritySection() {
  const securityFeatures = [
    {
      icon: <Shield className="w-5 h-5 text-emerald-400" />,
      title: 'Isolated Sandbox Execution',
      description:
        'Every project compiles inside a jailed workspace directory with dedicated port mapping, isolated process lifecycle, and bounded resource limits.',
    },
    {
      icon: <EyeOff className="w-5 h-5 text-emerald-400" />,
      title: 'Automated Secret Scrubbing',
      description:
        'API keys, database URIs, and authentication tokens are automatically detected and redacted ([REDACTED]) before being written to logs or terminal streams.',
    },
    {
      icon: <FileCheck2 className="w-5 h-5 text-emerald-400" />,
      title: '100% Code Ownership (MIT)',
      description:
        'Every file synthesized is standard TypeScript/React code. Zero proprietary SDKs, no runtime fees, and full freedom to deploy to Vercel, AWS, or Docker.',
    },
    {
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      title: 'Private & Local-First Persistence',
      description:
        'Projects and specifications are stored in your localized database. Your proprietary business logic and schemas are never sold or trained on.',
    },
  ];

  return (
    <section id="security" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-800">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Security & Trust</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Engineered for Safety and Control
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl mx-auto">
          We treat generated code with the same security rigor as production software. Process isolation, secret scrubbing, and full code ownership by default.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {securityFeatures.map((feat) => (
          <div
            key={feat.title}
            className="p-6 sm:p-7 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition flex gap-4 items-start shadow-xl"
          >
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0">
              {feat.icon}
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                {feat.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {feat.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
