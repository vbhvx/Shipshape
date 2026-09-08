'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

interface ComparisonRow {
  capability: string;
  description: string;
  shipshape: boolean | string;
  rawLlm: boolean | string;
  noCode: boolean | string;
  starters: boolean | string;
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    capability: 'Multi-File Next.js Synthesis',
    description: 'Generates cohesive App Router layouts, client components, and typed utilities.',
    shipshape: true,
    rawLlm: 'Single file or markdown blocks',
    noCode: false,
    starters: true,
  },
  {
    capability: 'Isolated Sandbox Execution',
    description: 'Boots an actual Node.js runtime to execute, test, and render the live app.',
    shipshape: true,
    rawLlm: false,
    noCode: 'Proprietary cloud only',
    starters: false,
  },
  {
    capability: '3-Attempt Automated Repair',
    description: 'Catches TypeScript and syntax errors, automatically applying surgical patches.',
    shipshape: 'Automated (3-attempts)',
    rawLlm: 'Manual reprompting',
    noCode: false,
    starters: false,
  },
  {
    capability: 'Line-by-Line Version Diffs',
    description: 'Inspect exact additions and removals before previewing, with one-click rollback.',
    shipshape: true,
    rawLlm: false,
    noCode: false,
    starters: 'Git only',
  },
  {
    capability: 'Complete .zip Source Export',
    description: 'Standard package.json, clean dependencies, and zero proprietary runtime lock-in.',
    shipshape: true,
    rawLlm: 'Manual copy/paste',
    noCode: false,
    starters: true,
  },
  {
    capability: 'Zero Platform Lock-in',
    description: 'Run anywhere: Vercel, Docker, AWS, or your local machine with `npm run dev`.',
    shipshape: true,
    rawLlm: true,
    noCode: false,
    starters: true,
  },
];

export default function ComparisonTable() {
  const renderCell = (value: boolean | string, isShipshape = false) => {
    if (typeof value === 'boolean') {
      return value ? (
        <div className="flex items-center justify-center">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isShipshape
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/80 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-600 flex items-center justify-center">
            <X className="w-3 h-3 stroke-[2]" />
          </div>
        </div>
      );
    }

    return (
      <span
        className={`text-xs text-center block ${
          isShipshape ? 'text-emerald-400 font-semibold' : 'text-zinc-400'
        }`}
      >
        {value}
      </span>
    );
  };

  return (
    <section id="compare" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-800">
          <span>Objective Comparison</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          How Shipshape Differs
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl mx-auto">
          Built specifically to eliminate the gap between generating code snippets and having an executable, testable full-stack application.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl backdrop-blur">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/90 text-xs text-zinc-300">
              <th className="p-4 sm:p-5 font-bold uppercase tracking-wider text-zinc-400 w-1/3">
                Capability
              </th>
              <th className="p-4 sm:p-5 font-bold text-center bg-zinc-900 border-x border-zinc-800 text-white w-1/4">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-extrabold">Shipshape</span>
                </div>
              </th>
              <th className="p-4 sm:p-5 font-medium text-center text-zinc-400 w-1/6">
                Raw LLM Prompts
              </th>
              <th className="p-4 sm:p-5 font-medium text-center text-zinc-400 w-1/6">
                No-Code Platforms
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 text-xs sm:text-sm">
            {COMPARISON_DATA.map((row) => (
              <tr
                key={row.capability}
                className="hover:bg-zinc-900/40 transition group"
              >
                <td className="p-4 sm:p-5 space-y-1">
                  <div className="font-bold text-zinc-100 group-hover:text-white transition">
                    {row.capability}
                  </div>
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    {row.description}
                  </div>
                </td>
                <td className="p-4 sm:p-5 bg-zinc-900/50 border-x border-zinc-800/90 text-center">
                  {renderCell(row.shipshape, true)}
                </td>
                <td className="p-4 sm:p-5 text-center text-zinc-400">
                  {renderCell(row.rawLlm)}
                </td>
                <td className="p-4 sm:p-5 text-center text-zinc-400">
                  {renderCell(row.noCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
