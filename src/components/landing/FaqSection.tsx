'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'What technology stack does Shipshape generate?',
    answer:
      'Shipshape synthesizes standard modern full-stack web applications using the Next.js App Router (React 19, TypeScript, and Tailwind CSS). Every generated project includes a complete package.json, tsconfig.json, modular component structure, and client/server utilities.',
  },
  {
    question: 'Do I own the generated code?',
    answer:
      'Yes, 100%. All generated code is yours under the open-source MIT license. There are no proprietary runtime SDKs, telemetry trackers, or platform lock-ins. You can export a standalone .zip archive at any time and run it locally with `npm install && npm run dev`.',
  },
  {
    question: 'How does the 3-attempt automated self-repair loop work?',
    answer:
      'Unlike simple prompt generators that output unchecked markdown code, Shipshape boots an isolated sandbox and runs a full compiler typecheck. If syntax, import, or TypeScript errors occur, the exact diagnostic errors are fed back into our repair engine to apply targeted patches. It attempts repair up to 3 times to guarantee a clean, runnable build.',
  },
  {
    question: 'How do iterative updates work after the initial generation?',
    answer:
      'Inside the Shipshape Workspace, you can iteratively refine your application via conversational prompts. Shipshape analyzes your existing code and creates surgical, line-by-line unified diffs (showing exact green additions and red deletions). You can review every change, test it live in the sandbox, or roll back to any prior version.',
  },
  {
    question: 'How do I deploy my application to production?',
    answer:
      'Because Shipshape outputs standard Next.js code with zero proprietary dependencies, you can deploy anywhere Next.js runs: one-click deployment to Vercel (`vercel deploy`), Netlify, AWS Amplify, or containerized via Docker for Kubernetes/Fly.io.',
  },
  {
    question: 'Is Shipshape free during the public beta?',
    answer:
      'Yes. During our public beta, full-stack application planning, multi-file synthesis, sandboxed live preview, iterative diffing, and source code export are completely free. No credit card is required to start building.',
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-800">
          <span>Got Questions?</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
          Everything you need to know about code ownership, sandboxing, and the generation pipeline.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={faq.question}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden transition-all hover:border-zinc-700"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="font-bold text-sm sm:text-base text-zinc-100">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-300 leading-relaxed border-t border-zinc-800/60">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
