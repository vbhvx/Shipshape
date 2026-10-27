'use client';

import React, { useState } from 'react';
import { ProjectSpecification } from '@/types';
import { FileText, CheckCircle2, ShieldCheck, Database, Layout, Sparkles } from 'lucide-react';

interface PlanSpecPanelProps {
  specification?: ProjectSpecification | null;
  onUpdateSpec?: (spec: Partial<ProjectSpecification>) => void;
}

export default function PlanSpecPanel({ specification }: PlanSpecPanelProps) {
  if (!specification) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center text-zinc-500 text-xs">
        No structured application plan exists yet. Submit a prompt to generate the plan.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6 text-xs text-zinc-300">
      {/* Title & Overview */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
          <FileText className="w-4 h-4" />
          <span>Project Specification (v{specification.versionNumber})</span>
        </div>
        <p className="text-zinc-400 leading-relaxed">{specification.description}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {specification.targetUsers?.map((user) => (
            <span key={user} className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-300">
              User: {user}
            </span>
          ))}
        </div>
      </div>

      {/* Routes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <Layout className="w-4 h-4 text-cyan-400" />
          <span>Planned Application Routes</span>
        </div>
        <div className="space-y-2">
          {specification.routes?.map((route) => (
            <div key={route.path} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-indigo-400 font-medium">{route.path}</span>
                <span className="text-[11px] text-zinc-400">{route.name}</span>
              </div>
              <p className="text-[11px] text-zinc-500">{route.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Core Features */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Features & Workflows</span>
        </div>
        <div className="space-y-2">
          {specification.features?.map((feat) => (
            <div key={feat.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-zinc-200">{feat.name}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{feat.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Model */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <Database className="w-4 h-4 text-violet-400" />
          <span>Data Model Entities</span>
        </div>
        <div className="space-y-2">
          {specification.dataEntities?.map((entity) => (
            <div key={entity.name} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="font-semibold text-zinc-200">{entity.name}</div>
              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                {entity.fields?.map((f) => (
                  <div key={f.name} className="px-2 py-1 bg-zinc-950 rounded border border-zinc-800/80 text-zinc-400">
                    <span className="text-zinc-200">{f.name}</span>: {f.type}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Acceptance Criteria</span>
        </div>
        <ul className="space-y-1.5 list-disc list-inside text-[11px] text-zinc-400 pl-1">
          {specification.acceptanceCriteria?.map((crit, idx) => (
            <li key={idx} className="leading-relaxed">
              {crit}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
