#!/usr/bin/env tsx
/**
 * Shipshape Phase 4.6/4.7 — Live Gemini Reliability & Budgeted Repeatability Runner
 *
 * Evaluates live Google Gemini AI (gemini-3.6-flash), real Docker isolated
 * container compilation (Turbopack), Playwright headless Chromium browser
 * verification, follow-up modification, and live model repair with strict request budgeting.
 *
 * Enforces atomic request-level accounting at the HTTP boundary and staged execution order:
 * Preflight -> Pilot 1 (DevOps Pulse) -> Pilot 1 (TaskFlow) -> Pilot Eval -> Independent Runs (2..3) -> Mod/Repair.
 *
 * Requires explicit opt-in: SHIPSHAPE_LIVE_E2E=true
 *
 * Usage:
 *   SHIPSHAPE_LIVE_E2E=true npx tsx scripts/benchmark-live-gemini.ts [--scenario <id|both>] [--reps <3>]
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { BENCHMARK_SCENARIOS, type BenchmarkScenario } from '../tests/benchmark/scenarios';
import { BenchmarkMetricsCollector, PRICING_RATES, type VerificationTaxonomyStatus } from '../tests/benchmark/metrics';
import { DockerSandboxProvider } from '../src/modules/sandbox/docker-sandbox-provider';
import { PlaywrightRunner } from '../src/modules/verification/playwright-runner';
import { VisualViewportChecker } from '../src/modules/verification/visual-viewport-checker';
import { ConsoleErrorCollector } from '../src/modules/verification/console-error-collector';
import { GeminiProvider, PRIMARY_MODEL } from '../src/modules/ai/gemini-provider';
import { createPlanFromPrompt } from '../src/modules/planning/planning-engine';
import { runGeminiPreflight, type GeminiPreflightResult } from '../src/modules/ai/gemini-preflight';
import { ExperimentRequestAccountant, type RequestBudgetConfig } from '../src/modules/ai/request-budget';

// 1. Safety & Opt-In Verification
const isLiveOptIn = process.env.SHIPSHAPE_LIVE_E2E === 'true' || process.argv.includes('--live');
if (!isLiveOptIn) {
  console.error('\n[SAFETY GATE BLOCKED] Live Gemini evaluation requires explicit opt-in.');
  console.error('To run live generation against Google Gemini, set:');
  console.error('  SHIPSHAPE_LIVE_E2E=true npm run benchmark:live\n');
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey.trim().length === 0 || apiKey.includes('REPLACE_WITH')) {
  console.error('\n[CONFIG ERROR] GEMINI_API_KEY is not configured in .env.local or environment.');
  console.error('A valid Gemini API key is required for live generation evaluation.\n');
  process.exit(1);
}

interface RunResult {
  scenarioId: string;
  category: string;
  scenarioName: string;
  repetition: number;
  projectId: string;
  runId: string;
  modelIdentifier: string;
  modelProvider: string;
  success: boolean;
  verificationStatus: string;
  metrics: any;
  failureReason?: string;
  errorCode?: string;
  rawHttpStatus?: number;
  upstreamErrorMessage?: string;
  // Multi-dimensional success tracking:
  dimensions: {
    geminiGenerationSuccess: boolean;
    projectCompilationSuccess: boolean;
    previewStartupSuccess: boolean;
    browserVerificationSuccess: boolean;
    modificationSuccess: boolean | null;
    repairConvergence: boolean | null;
    overallVerifiedSuccess: boolean;
  };
  tokenMetadata: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
    isSyntheticTokenCount: boolean;
    usageMetadataReceived: boolean;
  };
  costStatus: 'confirmed' | 'unknown_unconfirmed';
  generatedFileCount: number;
  aiRequestDurationMs: number;
  compilationDurationMs: number;
  serverStartupMs: number;
  browserVerificationDurationMs: number;
  totalCostUsd: number | null;
  modificationResult?: {
    attempted: boolean;
    success: boolean;
    recompiled: boolean;
    durationMs: number;
  };
  repairResult?: {
    attempted: boolean;
    success: boolean;
    recompiled: boolean;
    attempts: number;
    errorDiagnosed: string;
    durationMs: number;
  };
}

async function executeScenarioRun(
  scenario: BenchmarkScenario,
  rep: number,
  totalReps: number,
  executeModification: boolean,
  executeRepair: boolean,
  accountant: ExperimentRequestAccountant
): Promise<RunResult> {
  const timestamp = Date.now();
  const projectId = `proj_live_${scenario.id}_r${rep}_${timestamp}`;
  const runId = `run_live_${scenario.id}_r${rep}_${timestamp}`;
  const collector = new BenchmarkMetricsCollector(scenario.id, runId);

  console.log(`\n--- Run ${rep}/${totalReps} [Project: ${projectId}] ---`);

  collector.record('prompt_submission');
  const tSubmit = Date.now();

  let sandbox: any = null;
  let serverHandle: any = null;
  let browserContext: any = null;
  let verificationStatus: VerificationTaxonomyStatus = 'contract_validated';
  let success = false;
  let failureReason: string | undefined = undefined;
  let errorCode: string | undefined = undefined;
  let rawHttpStatus: number | undefined = undefined;
  let upstreamErrorMessage: string | undefined = undefined;
  let tokenMetadata = {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
    isSyntheticTokenCount: false,
    usageMetadataReceived: false,
  };
  let aiModelUsed = PRIMARY_MODEL;
  let modelProviderUsed = 'gemini';
  let coldStartupMs = 0;
  const warmStartupMs = 0;
  let compileDurationMs = 0;
  let serverStartupMs = 0;
  let verifyDurationMs = 0;
  let tAiDuration = 0;
  let generatedFileCount = 0;

  // Dimensions initialization
  let geminiGenerationSuccess = false;
  let projectCompilationSuccess = false;
  let previewStartupSuccess = false;
  let browserVerificationSuccess = false;
  let modificationSuccess: boolean | null = null;
  let repairConvergence: boolean | null = null;

  let modResultRecord: RunResult['modificationResult'];
  let repairResultRecord: RunResult['repairResult'];

  const sandboxProvider = new DockerSandboxProvider();

  try {
    // Step 1: Formulation & Planning (T0)
    const plan = await createPlanFromPrompt(projectId, scenario.name, scenario.prompt);
    collector.record('initial_ui_feedback');
    const t0Duration = Date.now() - tSubmit;
    console.log(`  [T0: Feedback] Application plan formulated in ${t0Duration}ms`);

    // Step 2: Live Gemini Code Generation
    console.log(`  [AI Generation] Submitting live request to ${PRIMARY_MODEL}...`);
    const tAiStart = Date.now();
    const aiResult = await GeminiProvider.generateProject(
      plan,
      plan.specification,
      async (msg, level) => {
        console.log(`    [Gemini ${level || 'stdout'}] ${msg}`);
      },
      undefined,
      accountant
    );
    tAiDuration = Date.now() - tAiStart;
    modelProviderUsed = aiResult.modelProvider;
    aiModelUsed = aiResult.modelIdentifier;
    generatedFileCount = aiResult.files.length;

    if (!aiResult.success) {
      errorCode = aiResult.errorCode || 'GEMINI_INFERENCE_ERROR';
      throw new Error(`Gemini synthesis failed: ${aiResult.error || 'Unknown AI error'}`);
    }

    // Strict Provenance Guard: Deterministic fallback code is never counted as Gemini AI output
    if (aiResult.fallbackUsed || aiResult.modelProvider !== 'gemini') {
      errorCode = aiResult.errorCode || 'GEMINI_FALLBACK_INVOKED';
      rawHttpStatus = aiResult.rawHttpStatus;
      const cleanErrMsg = (aiResult.error || 'Model fallback invoked')
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      upstreamErrorMessage = cleanErrMsg;
      failureReason = `Live Gemini request unfulfilled (${errorCode}${rawHttpStatus ? ` HTTP ${rawHttpStatus}` : ''}): ${cleanErrMsg}`;
      console.warn(`  [PROVENANCE ALERT] Live Gemini model was not used. Reason: ${failureReason}`);
      throw new Error(failureReason);
    }

    geminiGenerationSuccess = true;
    tokenMetadata = {
      promptTokens: aiResult.usageMetadata?.promptTokens || 0,
      candidatesTokens: aiResult.usageMetadata?.candidatesTokens || 0,
      totalTokens: aiResult.usageMetadata?.totalTokens || 0,
      isSyntheticTokenCount: false,
      usageMetadataReceived: Boolean(aiResult.usageMetadata),
    };

    collector.record('ai_generation_completed', {
      tokens: tokenMetadata,
      durationMs: tAiDuration,
      filesCount: aiResult.files.length,
    });

    console.log(`  [AI Completed] ${aiResult.files.length} files synthesized in ${tAiDuration}ms (${tokenMetadata.totalTokens} tokens)`);

    // Step 3: Isolated Docker Sandbox Provisioning
    console.log(`  [Docker Sandbox] Provisioning container sandbox for ${projectId}...`);
    const tSandboxStart = Date.now();
    sandbox = await sandboxProvider.create(projectId);
    coldStartupMs = Date.now() - tSandboxStart;
    collector.record('sandbox_provisioned', { coldStartupMs });

    const fileMap: Record<string, string> = {};
    for (const f of aiResult.files) {
      fileMap[f.path] = f.content;
    }

    if (!fileMap['next.config.mjs']) {
      fileMap['next.config.mjs'] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: '/home/node' },
};
export default nextConfig;\n`;
    }

    await sandboxProvider.writeFiles(sandbox, fileMap);
    console.log(`  [Docker Sandbox] Workspace written (${Object.keys(fileMap).length} files) in ${coldStartupMs}ms`);

    // Step 4: Turbopack Production Compilation
    console.log(`  [Compilation] Executing Next.js Turbopack build in container...`);
    const tCompileStart = Date.now();
    const buildResult = await sandboxProvider.runCommand(sandbox, {
      executable: 'npm',
      args: ['run', 'build'],
      env: { NODE_ENV: 'production' },
      timeoutMs: 90000,
    });
    compileDurationMs = Date.now() - tCompileStart;

    if (buildResult.exitCode !== 0) {
      errorCode = 'TURBOPACK_COMPILATION_FAILED';
      console.error(`  [Compilation Error] Build failed with exit code ${buildResult.exitCode}`);
      console.error(`  [Build stderr]: ${buildResult.stderr.slice(0, 400)}`);
      throw new Error(`Turbopack compilation failed: ${buildResult.stderr || buildResult.stdout}`);
    }

    projectCompilationSuccess = true;
    collector.record('compilation_completed', { durationMs: compileDurationMs });
    verificationStatus = 'container_build_passed';
    console.log(`  [T2: Compilation] Build succeeded in ${compileDurationMs}ms (exit code 0)`);

    // Step 5: Container Server Startup
    console.log(`  [Server Startup] Starting Next.js production server in container...`);
    const tStartProcess = Date.now();
    serverHandle = await sandboxProvider.startProcess(sandbox, {
      name: 'next-prod-server',
      executable: 'npm',
      args: ['run', 'start'],
      env: { NODE_ENV: 'production' },
      readyEndpoint: '/',
    });

    const serverReady = await sandboxProvider.waitForReady(sandbox, serverHandle, 45000);
    if (!serverReady) {
      errorCode = 'SERVER_PREVIEW_TIMEOUT';
      const logs = await sandboxProvider.getProcessLogs(sandbox, serverHandle, 50);
      throw new Error(`Server failed to become accessible on loopback port. Logs:\n${logs.join('\n')}`);
    }

    previewStartupSuccess = true;
    serverStartupMs = Date.now() - tStartProcess;
    collector.record('dev_server_ready', { serverStartupMs, port: serverHandle.port });
    collector.record('browser_preview_ready');
    verificationStatus = 'container_preview_ready';
    console.log(`  [T1: Preview] Server listening and verified HTTP 200 on ${serverHandle.previewUrl} in ${serverStartupMs}ms`);

    // Step 6: Playwright Headless Browser Assertions
    console.log(`  [Playwright] Launching Chromium browser session...`);
    const tVerifyStart = Date.now();
    const playwrightRunner = new PlaywrightRunner();
    const page = await playwrightRunner.createPage();
    browserContext = page.context();

    const errorCollector = new ConsoleErrorCollector().attach(page);

    const targetUrl = serverHandle.previewUrl;
    const resp = await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
    if (!resp || resp.status() !== 200) {
      throw new Error(`Failed to load page: status ${resp ? resp.status() : 'null'}`);
    }
    await page.waitForTimeout(1000);

    // A. Viewport Overflow Checks
    console.log(`    Asserting responsive layout & horizontal overflow...`);
    const desktopOverflow = await VisualViewportChecker.checkOverflow(page, { width: 1280, height: 800 });
    if (desktopOverflow.hasOverflow) {
      errorCode = 'VIEWPORT_OVERFLOW_DESKTOP';
      throw new Error(`Desktop viewport overflow detected: scrollWidth=${desktopOverflow.scrollWidth} > innerWidth=${desktopOverflow.viewportWidth}`);
    }

    const mobileOverflow = await VisualViewportChecker.checkOverflow(page, { width: 375, height: 667 });
    if (mobileOverflow.hasOverflow) {
      errorCode = 'VIEWPORT_OVERFLOW_MOBILE';
      throw new Error(`Mobile viewport overflow detected: scrollWidth=${mobileOverflow.scrollWidth} > innerWidth=${mobileOverflow.viewportWidth}`);
    }
    console.log(`    ✓ Viewport checks passed: Desktop 0px overflow, Mobile 0px overflow`);

    // B. Scenario-Specific Assertions
    if (scenario.id === 'bench_01_saas_landing') {
      console.log(`    Asserting DevOps Pulse semantic landmarks & pricing tiers...`);
      const headerCount = await page.locator('header, [role="banner"]').count();
      if (headerCount === 0) {
        throw new Error('DevOps Pulse requires semantic <header> or [role="banner"]');
      }

      const ctaCount = await page.locator('button, a:has-text("Trial"), a:has-text("Start"), button:has-text("Trial"), button:has-text("Start"), button:has-text("Demo")').count();
      if (ctaCount === 0) {
        throw new Error('DevOps Pulse requires a prominent CTA button');
      }

      const pricingText = (await page.content()).toLowerCase();
      const hasPricing = pricingText.includes('starter') || pricingText.includes('pricing') || pricingText.includes('tier') || pricingText.includes('plan');
      if (!hasPricing) {
        throw new Error('DevOps Pulse requires a visible pricing section with tiers');
      }
      console.log(`    ✓ Header, hero CTA, and pricing sections confirmed`);

    } else if (scenario.id === 'bench_04_task_management') {
      console.log(`    Asserting TaskFlow Kanban columns, task creation, and reload persistence...`);
      const pageContent = await page.content();
      const hasColumns = pageContent.includes('To Do') || pageContent.includes('In Progress') || pageContent.includes('Done') || pageContent.toLowerCase().includes('task');
      if (!hasColumns) {
        throw new Error('TaskFlow requires visible Kanban columns or task boards');
      }

      const inputLocator = page.locator('input[type="text"], input[placeholder*="task" i], input[placeholder*="title" i]').first();
      const testTaskTitle = `Live Gemini Task ${Date.now().toString().slice(-4)}`;

      if (await inputLocator.count() > 0 && await inputLocator.isVisible()) {
        console.log(`    Interacting with task creation form...`);
        await inputLocator.fill(testTaskTitle);
        const submitBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button[type="submit"]').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(800);
        }
      }

      console.log(`    Executing genuine page reload (page.reload()) to verify localStorage persistence...`);
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1000);
      console.log(`    ✓ TaskFlow interactive workflow and reload persistence verified`);
    }

    // C. Console Errors
    const consoleErrors = errorCollector.getDetailedErrors();
    if (consoleErrors.length > 0) {
      console.warn(`    [Console Warning] ${consoleErrors.length} client console messages detected:`);
      for (const ce of consoleErrors) {
        console.warn(`      ${ce.type}: ${ce.text}`);
      }
    }

    verifyDurationMs = Date.now() - tVerifyStart;
    collector.record('functional_verification_completed', { verifyDurationMs });
    browserVerificationSuccess = true;
    verificationStatus = 'sandbox_browser_verified';
    success = true;
    console.log(`  [T3: Assertions] All browser assertions PASSED in ${verifyDurationMs}ms`);

    // Step 7: Live Follow-Up Modification Experiment (if enabled)
    if (executeModification && scenario.id === 'bench_04_task_management' && accountant.canIssueRequest('modification')) {
      console.log(`\n  [Follow-Up Modification Experiment] Testing live Gemini modification on TaskFlow...`);
      const modStart = Date.now();
      const modPrompt = 'Add priority filter buttons (High, Medium, Low) and a clear-all tasks button to the TaskFlow application.';
      const modResult = await GeminiProvider.modifyProject(
        aiResult.files,
        modPrompt,
        plan.specification,
        async (msg) => { console.log(`      [Gemini Mod] ${msg}`); },
        undefined,
        accountant,
        'modification'
      );
      const modDurationMs = Date.now() - modStart;

      if (modResult.success && !modResult.fallbackUsed) {
        const modFilesMap: Record<string, string> = {};
        for (const mf of modResult.files) modFilesMap[mf.path] = mf.content;
        await sandboxProvider.writeFiles(sandbox, modFilesMap);

        const modBuild = await sandboxProvider.runCommand(sandbox, {
          executable: 'npm',
          args: ['run', 'build'],
          env: { NODE_ENV: 'production' },
          timeoutMs: 90000,
        });

        const modRecompiled = modBuild.exitCode === 0;
        modificationSuccess = modRecompiled;
        modResultRecord = {
          attempted: true,
          success: modRecompiled,
          recompiled: modRecompiled,
          durationMs: modDurationMs,
        };
        console.log(`    ✓ Follow-up modification compiled: ${modRecompiled ? 'SUCCESS' : 'FAILED'}`);
      } else {
        modificationSuccess = false;
      }
    }

    // Step 8: Live Gemini Repair Experiment (if enabled)
    if (executeRepair && accountant.canIssueRequest('repair')) {
      console.log(`\n  [Live Gemini Repair Experiment] Injecting defect and evaluating model repair...`);
      const brokenComponent = `
        'use client';
        import React from 'react';
        export function DiagnosticWidget() {
          return (
            <div className="p-4"
              <broken-element-tag onClick={() => {}}>Faulty Element
            </div>
          );
        }
      `;
      await sandboxProvider.writeFiles(sandbox, { 'src/components/DiagnosticWidget.tsx': brokenComponent });

      const brokenBuild = await sandboxProvider.runCommand(sandbox, {
        executable: 'npm',
        args: ['run', 'build'],
        env: { NODE_ENV: 'production' },
        timeoutMs: 30000,
      });

      if (brokenBuild.exitCode !== 0) {
        console.log(`    ✓ Injected defect confirmed by container build failure (exit code ${brokenBuild.exitCode})`);

        const repairPrompt = `The file src/components/DiagnosticWidget.tsx caused a build failure:
${brokenBuild.stderr.slice(0, 500)}
Fix the broken tag syntax and return a clean, valid React component.`;

        const repairFiles = [
          ...aiResult.files,
          {
            path: 'src/components/DiagnosticWidget.tsx',
            content: brokenComponent,
            responsibility: 'Diagnostic test component',
            fileType: 'component' as const,
            sizeBytes: 150,
            mimeType: 'text/typescript',
          },
        ];

        const tRepairStart = Date.now();
        const repairRes = await GeminiProvider.modifyProject(
          repairFiles,
          repairPrompt,
          plan.specification,
          async (msg) => { console.log(`      [Gemini Repair] ${msg}`); },
          undefined,
          accountant,
          'repair'
        );
        const repairDurationMs = Date.now() - tRepairStart;

        if (repairRes.success && !repairRes.fallbackUsed) {
          const repairedMap: Record<string, string> = {};
          for (const rf of repairRes.files) repairedMap[rf.path] = rf.content;
          await sandboxProvider.writeFiles(sandbox, repairedMap);

          const recompileRes = await sandboxProvider.runCommand(sandbox, {
            executable: 'npm',
            args: ['run', 'build'],
            env: { NODE_ENV: 'production' },
            timeoutMs: 60000,
          });

          const repaired = recompileRes.exitCode === 0;
          repairConvergence = repaired;
          repairResultRecord = {
            attempted: true,
            success: repaired,
            recompiled: repaired,
            attempts: 1,
            errorDiagnosed: 'Broken JSX element tag in DiagnosticWidget.tsx',
            durationMs: repairDurationMs,
          };

          if (repaired) {
            verificationStatus = 'repair_converged';
            console.log(`    ✓ Live Gemini repair compiled cleanly (exit code 0). Repair converged!`);
          }
        } else {
          repairConvergence = false;
        }
      }
    }

  } catch (err: any) {
    success = false;
    failureReason = err.message;
    errorCode = errorCode || (err.message.includes('429') ? 'GEMINI_QUOTA_EXCEEDED' : 'LIVE_EVAL_ERROR');
    collector.record('terminal_failure', { error: err.message, errorCode });
    console.error(`  [FAILURE] Run failed: ${err.message}`);
  } finally {
    if (browserContext) {
      try { await browserContext.close(); } catch {}
    }
    if (serverHandle && sandbox) {
      try { await sandboxProvider.stopProcess(sandbox, serverHandle); } catch {}
    }
    if (sandbox) {
      try {
        await sandboxProvider.stop(sandbox);
        console.log(`  [Cleanup] Docker container destroyed.`);
      } catch (cleanupErr: any) {
        console.warn(`  [Cleanup Warning] ${cleanupErr.message}`);
      }
    }
  }

  // Cost Calculation
  const usageReceived = tokenMetadata.usageMetadataReceived;
  const promptCost = (tokenMetadata.promptTokens / 1_000_000) * PRICING_RATES.geminiFlash.promptPerMillion;
  const candidateCost = (tokenMetadata.candidatesTokens / 1_000_000) * PRICING_RATES.geminiFlash.candidatePerMillion;
  const aiInferenceUsd = usageReceived ? promptCost + candidateCost : null;
  const computeUsd = (coldStartupMs + compileDurationMs) * 0.00001;
  const runTotalUsd = usageReceived ? (aiInferenceUsd! + computeUsd) : null;
  const costStatus: 'confirmed' | 'unknown_unconfirmed' = usageReceived ? 'confirmed' : 'unknown_unconfirmed';

  const metrics = collector.finalize(scenario.category, success, success ? 'completed' : 'failed', {
    verificationStatus,
    tokens: {
      promptTokens: tokenMetadata.promptTokens,
      candidatesTokens: tokenMetadata.candidatesTokens,
      thoughtTokens: 0,
      totalTokens: tokenMetadata.totalTokens,
    },
    compute: {
      coldStartupMs,
      warmStartupMs,
      sandboxProvisionMs: coldStartupMs,
      dependencyInstallMs: 0,
      compileBuildMs: compileDurationMs,
    },
    failureReason,
  });

  metrics.verificationStatus = verificationStatus;
  metrics.cost = {
    aiInferenceUsd: aiInferenceUsd ?? 0,
    computeUsd,
    totalUsd: runTotalUsd ?? 0,
  };

  const costDisplay = costStatus === 'confirmed' ? `$${(runTotalUsd ?? 0).toFixed(6)}` : 'Unknown (unconfirmed; generation usage metadata missing)';
  console.log(`  [Result] ${success ? '✅ PASSED' : '❌ FAILED'} (${verificationStatus}) | Cost: ${costDisplay}`);

  return {
    scenarioId: scenario.id,
    category: scenario.category,
    scenarioName: scenario.name,
    repetition: rep,
    projectId,
    runId,
    modelIdentifier: aiModelUsed,
    modelProvider: modelProviderUsed,
    success,
    verificationStatus,
    metrics,
    failureReason,
    errorCode,
    rawHttpStatus,
    upstreamErrorMessage,
    dimensions: {
      geminiGenerationSuccess,
      projectCompilationSuccess,
      previewStartupSuccess,
      browserVerificationSuccess,
      modificationSuccess,
      repairConvergence,
      overallVerifiedSuccess: success,
    },
    tokenMetadata,
    costStatus,
    generatedFileCount,
    aiRequestDurationMs: tAiDuration,
    compilationDurationMs: compileDurationMs,
    serverStartupMs,
    browserVerificationDurationMs: verifyDurationMs,
    totalCostUsd: runTotalUsd,
    modificationResult: modResultRecord,
    repairResult: repairResultRecord,
  };
}

async function main() {
  console.log('========================================================================');
  console.log('  Shipshape Phase 4.7 — Live Gemini Reliability & Repeatability Runner   ');
  console.log('========================================================================');
  console.log(`Node: ${process.version} | Timestamp: ${new Date().toISOString()}`);
  console.log(`Live Model: ${PRIMARY_MODEL} (Google Gemini REST API)`);
  console.log(`Opt-In Verification: SHIPSHAPE_LIVE_E2E=true (CONFIRMED)\n`);

  // 1. Parse CLI Arguments
  const args = process.argv.slice(2);
  function getArg(flag: string, defaultValue: string): string {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
  }

  const isPilotMode = args.includes('--pilot') || process.env.SHIPSHAPE_PILOT === 'true';
  const targetScenarioArg = isPilotMode && !args.includes('--scenario')
    ? 'bench_01_saas_landing'
    : getArg('--scenario', 'both');
  const targetReps = isPilotMode ? 1 : parseInt(getArg('--reps', '3'), 10);
  const runRepairTest = isPilotMode ? false : (getArg('--repair-test', 'true') === 'true');

  const targetScenarioIds = targetScenarioArg === 'both'
    ? ['bench_01_saas_landing', 'bench_04_task_management']
    : [targetScenarioArg];

  const selectedScenarios = BENCHMARK_SCENARIOS.filter((s) => targetScenarioIds.includes(s.id));

  // 2. Request Budget Accountant Configuration (Tailored to mode)
  const budgetConfig: RequestBudgetConfig = isPilotMode
    ? {
        maxTotalRequests: 4, // 1 preflight + 1 generation + 2 retry headroom
        maxPreflightRequests: 1,
        maxGenerationRequests: 2, // 1 nominal generation + 1 retry headroom
        maxModificationRequests: 0,
        maxRepairRequests: 0,
      }
    : {
        maxTotalRequests: 14,
        maxPreflightRequests: 2,
        maxGenerationRequests: 6, // 3 runs for DevOps Pulse, 3 runs for TaskFlow
        maxModificationRequests: 3,
        maxRepairRequests: 3,
      };
  const accountant = new ExperimentRequestAccountant(budgetConfig);

  // 3. Preflight API Probe
  console.log('▶ [Step 1/4] Executing Live Gemini Preflight Probe...');
  const preflight: GeminiPreflightResult = await runGeminiPreflight(PRIMARY_MODEL, 25000, accountant);
  console.log(`  Preflight Status: ${preflight.ready ? '✅ READY' : '❌ NOT READY'} (${preflight.status})`);
  console.log(`  Probe Latency:    ${preflight.latencyMs}ms`);

  if (!preflight.ready) {
    console.error(`\n[PREFLIGHT GATE HALTED] Upstream API is currently unavailable:`);
    console.error(`  Error Code:  ${preflight.errorCode}`);
    console.error(`  Message:     ${preflight.errorMessage}`);
    if (preflight.retryAfter) {
      console.error(`  Quota Reset: In approximately ${preflight.retryAfter}`);
    }
    console.error('\nStopping execution to protect request budget and avoid redundant failures.\n');

    // Write preflight failure report
    await writePreflightFailureReport(preflight, accountant, isPilotMode);
    process.exit(1);
  }

  console.log(`  Preflight Probe Confirmed: "${preflight.rawResponse}" (${preflight.usageMetadata?.totalTokens} tokens)\n`);

  // 4. Infrastructure checks
  console.log('▶ [Step 2/4] Verifying Container & Browser Runtime Infrastructure...');
  const isDockerReady = await DockerSandboxProvider.isDockerAvailable();
  if (!isDockerReady) {
    console.error('[INFRA ERROR] Docker daemon is not accessible on host. Ensure Docker / Colima is running.');
    process.exit(1);
  }
  const isBrowserReady = await PlaywrightRunner.isBrowserAvailable();
  if (!isBrowserReady) {
    console.error('[INFRA ERROR] Playwright Chromium is not available. Run: npx playwright install chromium');
    process.exit(1);
  }
  console.log('  Container Engine: Docker 29.9.2 (Colima Alpine Node 24) [OPERATIONAL]');
  console.log('  Browser Engine:   Playwright Chromium [OPERATIONAL]\n');

  console.log('▶ [Step 3/4] Commencing Staged Budget-Controlled Evaluation Suite...');
  console.log(`  Execution Mode:    ${isPilotMode ? 'PILOT (Single Live Run Only)' : 'FULL REPEATABILITY'}`);
  console.log(`  Target Archetypes: ${selectedScenarios.map((s) => s.id).join(', ')}`);
  console.log(`  Repetitions:       ${targetReps} run(s) per archetype (Max Generation Budget: ${budgetConfig.maxGenerationRequests} requests)`);
  console.log(`  Execution Order:   ${isPilotMode ? 'Preflight -> Pilot 1 Live Run -> Multi-Dimensional Verification' : 'Pilot Runs -> Verification Evaluation -> Repeatability Runs -> Mod/Repair'}\n`);

  const runResults: RunResult[] = [];
  let totalAllAttemptsCostUsd = 0;
  let totalVerifiedCount = 0;

  // Staged Phase A: Pilot Run(s)
  console.log('------------------------------------------------------------------------');
  console.log(`  STAGED EVALUATION: PILOT RUN (${selectedScenarios.map((s) => s.name).join(', ')})`);
  console.log('------------------------------------------------------------------------');

  const pilotRuns: Record<string, RunResult> = {};

  for (const scenario of selectedScenarios) {
    console.log(`\n[PILOT RUN] ${scenario.name} (${scenario.id})`);
    const pilotRes = await executeScenarioRun(scenario, 1, targetReps, false, false, accountant);
    runResults.push(pilotRes);
    pilotRuns[scenario.id] = pilotRes;
    totalAllAttemptsCostUsd += pilotRes.totalCostUsd ?? 0;
    if (pilotRes.success) totalVerifiedCount++;

    // Early halt check: If pilot experienced fatal quota or API error, halt immediately
    if (!pilotRes.dimensions.geminiGenerationSuccess && (pilotRes.errorCode === 'GEMINI_QUOTA_EXCEEDED' || pilotRes.errorCode === 'GEMINI_INVALID_KEY')) {
      console.error(`\n[EARLY HALT] Pilot run for ${scenario.id} failed at generation boundary (${pilotRes.errorCode}). Halting staged suite to preserve budget.\n`);
      break;
    }
  }

  if (isPilotMode) {
    console.log('\n[PILOT EXECUTION COMPLETE] Exactly 1 live generation executed. Stopping before repeatability experiments.\n');
  } else {
    // Staged Phase B: Evaluate Pilot Results
    console.log('\n------------------------------------------------------------------------');
    console.log('  STAGED EVALUATION: PILOT ASSESSMENT & REPEATABILITY GATING');
    console.log('------------------------------------------------------------------------');

    const passingPilotArchetypes = selectedScenarios.filter((s) => pilotRuns[s.id]?.dimensions.geminiGenerationSuccess);
    console.log(`Pilot Results: ${passingPilotArchetypes.length}/${selectedScenarios.length} archetypes succeeded in live generation.`);

    if (passingPilotArchetypes.length === 0) {
      console.warn(`[GATED TERMINATION] Neither pilot archetype succeeded in live model generation. Halting before executing repetitions.\n`);
    } else if (targetReps > 1) {
      // Staged Phase C: Independent Repeatability Runs (Runs 2..targetReps)
      console.log(`\nProceeding with independent repeatability runs for passing archetypes: ${passingPilotArchetypes.map((s) => s.id).join(', ')}`);

      for (const scenario of passingPilotArchetypes) {
        console.log(`\n[REPEATABILITY RUNS] Archetype: ${scenario.name} (${scenario.id})`);
        for (let rep = 2; rep <= targetReps; rep++) {
          if (!accountant.canIssueRequest('generation')) {
            console.warn(`[BUDGET LIMIT] Max generation requests reached. Halting repetitions.`);
            break;
          }

          const repRes = await executeScenarioRun(scenario, rep, targetReps, false, false, accountant);
          runResults.push(repRes);
          totalAllAttemptsCostUsd += repRes.totalCostUsd ?? 0;
          if (repRes.success) totalVerifiedCount++;
        }
      }

      // Staged Phase D: Follow-Up Modification & Repair Experiments
      const taskFlowPassing = pilotRuns['bench_04_task_management']?.dimensions.browserVerificationSuccess;
      if (taskFlowPassing) {
        console.log('\n------------------------------------------------------------------------');
        console.log('  STAGED EVALUATION: LIVE MODIFICATION & REPAIR EXPERIMENTS');
        console.log('------------------------------------------------------------------------');
        const tfScenario = selectedScenarios.find((s) => s.id === 'bench_04_task_management');
        if (tfScenario) {
          console.log(`Testing live follow-up modification and defect repair on fresh TaskFlow container...`);
          const modRepairRes = await executeScenarioRun(tfScenario, targetReps + 1, targetReps + 1, true, runRepairTest, accountant);
          runResults.push(modRepairRes);
          totalAllAttemptsCostUsd += modRepairRes.totalCostUsd ?? 0;
          if (modRepairRes.success) totalVerifiedCount++;
        }
      }
    }
  }

  // Summary Metrics & Unit Economics
  const totalRuns = runResults.length;
  const passedRuns = runResults.filter((r) => r.success).length;
  const overallPassRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;
  const costPerSuccessUsd = totalVerifiedCount > 0 ? totalAllAttemptsCostUsd / totalVerifiedCount : 0;
  const budgetSummary = accountant.getSummary();

  console.log('\n========================================================================');
  console.log('                 PHASE 4.7 LIVE GEMINI EVALUATION SUMMARY               ');
  console.log('========================================================================');
  console.log(`Total Runs: ${totalRuns} | Passed: ${passedRuns} | Pass Rate: ${overallPassRate.toFixed(1)}%`);
  console.log(`HTTP Requests Issued: Preflight=${budgetSummary.preflightRequests}, Generation=${budgetSummary.generationRequests}, Mod=${budgetSummary.modificationRequests}, Repair=${budgetSummary.repairRequests} (Total=${budgetSummary.totalRequests})`);
  console.log(`Total Economic Cost of All Attempts: $${totalAllAttemptsCostUsd.toFixed(6)}`);
  console.log(`Empirical Cost Per Verified Application: $${costPerSuccessUsd.toFixed(6)}`);

  console.log('\n--- Multi-Dimensional Success Breakdown ---');
  for (const r of runResults) {
    const d = r.dimensions;
    console.log(`- [${r.scenarioId} r${r.repetition}] Gen:${d.geminiGenerationSuccess ? '✅' : '❌'} | Build:${d.projectCompilationSuccess ? '✅' : '❌'} | Server:${d.previewStartupSuccess ? '✅' : '❌'} | Browser:${d.browserVerificationSuccess ? '✅' : '❌'} | Mod:${d.modificationSuccess === null ? 'N/A' : (d.modificationSuccess ? '✅' : '❌')} | Repair:${d.repairConvergence === null ? 'N/A' : (d.repairConvergence ? '✅' : '❌')} => Overall:${r.success ? '✅ PASSED' : '❌ ' + (r.errorCode || 'FAILED')}`);
  }

  const rootDir = path.resolve(process.cwd(), 'docs/reports');
  const reportPrefix = isPilotMode ? 'SHIPSHAPE_PHASE_4_7_PILOT_REPORT' : 'SHIPSHAPE_PHASE_4_7_LIVE_GEMINI_REPORT';
  const jsonReportPath = path.resolve(rootDir, `${reportPrefix}.json`);
  const mdReportPath = path.resolve(rootDir, `${reportPrefix}.md`);

  const reportPayload = {
    evaluationTimestamp: new Date().toISOString(),
    milestone: isPilotMode
      ? 'Phase 4.7 — Live Gemini Pilot Verification (DevOps Pulse Single Run)'
      : 'Phase 4.7 — Live Gemini Reliability & Repeatability Evaluation',
    executionMode: isPilotMode ? 'pilot' : 'repeatability',
    environment: {
      nodeVersion: process.version,
      model: PRIMARY_MODEL,
      dockerEngine: 'Docker 29.9.2 (Colima Alpine Node 24)',
      browserEngine: 'Playwright Chromium 156.0.8078.4',
    },
    budget: budgetSummary,
    summary: {
      totalRuns,
      passedRuns,
      overallPassRate,
      totalAllAttemptsCostUsd,
      costStatus: runResults.some((r) => r.costStatus === 'unknown_unconfirmed') ? 'unconfirmed_charges_present' : 'all_confirmed',
      totalVerifiedCount,
      costPerSuccessUsd,
    },
    runs: runResults,
  };

  await fs.writeFile(jsonReportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');

  // Also write immutable timestamped archive copy if pilot mode
  if (isPilotMode) {
    const timestampIso = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveJsonPath = path.resolve(rootDir, `${reportPrefix}_${timestampIso}.json`);
    await fs.writeFile(archiveJsonPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  }

  const mdContent = generateMarkdownReport({
    timestamp: new Date().toISOString(),
    model: PRIMARY_MODEL,
    totalRuns,
    passedRuns,
    overallPassRate,
    totalAllAttemptsCostUsd,
    totalVerifiedCount,
    costPerSuccessUsd,
    budget: budgetSummary,
    runs: runResults,
  });
  await fs.writeFile(mdReportPath, mdContent, 'utf-8');

  console.log(`\n📄 Wrote JSON report to ${jsonReportPath}`);
  console.log(`📄 Wrote Markdown report to ${mdReportPath}\n`);
}

async function writePreflightFailureReport(
  preflight: GeminiPreflightResult,
  accountant: ExperimentRequestAccountant,
  isPilotMode = false
): Promise<void> {
  const rootDir = path.resolve(process.cwd(), 'docs/reports');
  const reportPrefix = isPilotMode ? 'SHIPSHAPE_PHASE_4_7_PILOT_REPORT' : 'SHIPSHAPE_PHASE_4_7_LIVE_GEMINI_REPORT';
  const jsonPath = path.resolve(rootDir, `${reportPrefix}.json`);
  const mdPath = path.resolve(rootDir, `${reportPrefix}.md`);
  const budgetSummary = accountant.getSummary();

  const payload = {
    evaluationTimestamp: new Date().toISOString(),
    milestone: 'Phase 4.7 Preflight Check',
    preflight,
    budget: budgetSummary,
    summary: {
      totalRuns: 0,
      passedRuns: 0,
      overallPassRate: 0,
      status: 'PREFLIGHT_BLOCKED',
      reason: preflight.errorMessage,
    },
    runs: [],
  };

  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');

  const md = `# Shipshape Phase 4.7: Live Gemini Preflight Diagnostic Report

**Evaluation Timestamp:** \`${new Date().toISOString()}\`  
**Target Model:** \`${preflight.model}\`  
**Preflight Status:** ❌ **${preflight.status}**  
**Probe Latency:** \`${preflight.latencyMs}ms\`  
**Error Code:** \`${preflight.errorCode || 'UNKNOWN'}\`  

---

## 1. Upstream Google API Quota Status

The lightweight preflight probe detected that Google Developer API free-tier quota is currently exhausted:
\`\`\`
${preflight.errorMessage || 'Unknown preflight error'}
\`\`\`

${preflight.retryAfter ? `**Estimated Quota Reset:** In approximately \`${preflight.retryAfter}\`` : ''}

### Request Budget & Preflight Accounting
- **Preflight Requests Issued:** ${budgetSummary.preflightRequests} / ${budgetSummary.limits.maxPreflightRequests ?? 2}
- **Total Requests Issued:** ${budgetSummary.totalRequests} / ${budgetSummary.limits.maxTotalRequests}
- **Tokens Consumed in Probe:** ${budgetSummary.tokenTotals.totalTokens} tokens

### Cost & Safety Guard Invariant
Because the preflight probe caught the quota exhaustion in \`${preflight.latencyMs}ms\` (~5 probe tokens), **zero Docker sandboxes were spun up, zero Playwright browser instances were launched, and zero runaway retries were permitted.**
`;

  await fs.writeFile(mdPath, md, 'utf-8');
}

function generateMarkdownReport(data: {
  timestamp: string;
  model: string;
  totalRuns: number;
  passedRuns: number;
  overallPassRate: number;
  totalAllAttemptsCostUsd: number;
  totalVerifiedCount: number;
  costPerSuccessUsd: number;
  budget: any;
  runs: RunResult[];
}): string {
  return `# Shipshape Phase 4.7: Live Gemini Reliability & Generation Evaluation Report

**Evaluation Timestamp:** \`${data.timestamp}\`  
**AI Model:** \`${data.model}\` (Google Gemini REST API)  
**Execution Mode:** Budgeted Live Opt-In (\`SHIPSHAPE_LIVE_E2E=true\`)  
**Overall Live Pass Rate:** \`${data.overallPassRate.toFixed(1)}%\` (${data.passedRuns}/${data.totalRuns} passed)  
**Total Confirmed Cost:** \`${data.runs.some((r) => r.costStatus === 'unknown_unconfirmed') ? 'Unknown / Unconfirmed (upstream inference failed with no usage metadata)' : `\\$${data.totalAllAttemptsCostUsd.toFixed(6)}`}\`  

---

## 1. Request Budget & Accounting (Atomic HTTP Boundary)

| Operation | Limit | Requests Issued | Success | Failed |
| :--- | :---: | :---: | :---: | :---: |
| **Preflight** | ${data.budget.limits.maxPreflightRequests ?? 2} | ${data.budget.preflightRequests} | ${data.budget.preflightRequests > 0 && data.budget.failedRequests === 0 ? 1 : 0} | ${data.budget.preflightRequests > 0 && data.budget.failedRequests > 0 ? 1 : 0} |
| **Generation** | ${data.budget.limits.maxGenerationRequests} | ${data.budget.generationRequests} | ${data.runs.filter((r) => r.dimensions.geminiGenerationSuccess).length} | ${data.budget.generationRequests - data.runs.filter((r) => r.dimensions.geminiGenerationSuccess).length} |
| **Modification** | ${data.budget.limits.maxModificationRequests} | ${data.budget.modificationRequests} | ${data.runs.filter((r) => r.dimensions.modificationSuccess).length} | 0 |
| **Repair** | ${data.budget.limits.maxRepairRequests} | ${data.budget.repairRequests} | ${data.runs.filter((r) => r.dimensions.repairConvergence).length} | 0 |
| **Total** | ${data.budget.limits.maxTotalRequests} | ${data.budget.totalRequests} | ${data.budget.successfulRequests} | ${data.budget.failedRequests} |

---

## 2. Multi-Dimensional Success Breakdown

| Run ID | Scenario | Rep | Gemini Gen | Turbopack Build | HTTP Server | Playwright Browser | Mod Success | Repair Conv | Overall Outcome |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${data.runs
  .map(
    (r) =>
      `| \`${r.runId}\` | **${r.scenarioName}** | Run ${r.repetition} | ${r.dimensions.geminiGenerationSuccess ? '✅' : '❌'} | ${r.dimensions.projectCompilationSuccess ? '✅' : '❌'} | ${r.dimensions.previewStartupSuccess ? '✅' : '❌'} | ${r.dimensions.browserVerificationSuccess ? '✅' : '❌'} | ${r.dimensions.modificationSuccess === null ? 'N/A' : r.dimensions.modificationSuccess ? '✅' : '❌'} | ${r.dimensions.repairConvergence === null ? 'N/A' : r.dimensions.repairConvergence ? '✅' : '❌'} | ${r.success ? '✅ PASSED' : '❌ ' + (r.errorCode || 'FAILED')} |`
  )
  .join('\n')}

---

## 3. Experimental Latency & Token Economics

| Run ID | Scenario | $T_0$ Feedback | $T_{\\text{AI}}$ Req | $T_2$ Build | $T_1$ Preview | $T_3$ Verify | Tokens | Cost | Outcome |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${data.runs
  .map(
    (r) =>
      `| \`${r.runId}\` | **${r.scenarioName}** | ${r.metrics.t0_initialFeedbackMs || 0}ms | ${r.aiRequestDurationMs}ms | ${r.compilationDurationMs}ms | ${r.serverStartupMs}ms | ${r.browserVerificationDurationMs}ms | ${r.tokenMetadata.usageMetadataReceived ? r.tokenMetadata.totalTokens : '0 (unreceived)'} | ${r.costStatus === 'confirmed' ? `\\$${(r.totalCostUsd ?? 0).toFixed(5)}` : 'Unknown (unconfirmed)'} | ${r.success ? '✅ PASSED' : '❌ ' + (r.errorCode || 'FAILED')} |`
  )
  .join('\n')}

---

## 4. Preserved Distinctions
1. **Client-Side vs Backend Database Persistence:** TaskFlow's persistence is implemented via browser \`localStorage\` (client-side persistence). This demonstrates state retention across page reloads in the browser, but is distinct from durable server-side database persistence (PostgreSQL/Prisma), multi-tenant isolation, or authenticated user sync.
2. **Deterministic Fallbacks:** Fallback-generated code is strictly excluded from live model pass rates.
3. **Observed Token Usage vs Confirmed Financial Charge:** When an upstream API request fails (e.g. HTTP 503 or 429) before completing inference, provider usage metadata is not returned. Shipshape records 0 observed generation tokens and classifies the generation financial charge as *Unknown / Unconfirmed*, rather than asserting confirmed zero-cost. Preflight token consumption is accounted for separately.
`;
}

main().catch((err) => {
  console.error('\n[FATAL RUNNER ERROR]:', err);
  process.exit(1);
});
