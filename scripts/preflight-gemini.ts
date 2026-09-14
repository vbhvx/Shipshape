#!/usr/bin/env tsx
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { runGeminiPreflight } from '../src/modules/ai/gemini-preflight';
import { PRIMARY_MODEL } from '../src/modules/ai/gemini-provider';

async function main() {
  console.log('================================================================');
  console.log(' SHIPSHAPE GEMINI API PREFLIGHT CHECK');
  console.log(` Target Model: ${PRIMARY_MODEL}`);
  console.log('================================================================\n');

  const result = await runGeminiPreflight(PRIMARY_MODEL);

  console.log(`Status:       ${result.ready ? '✅ READY' : '❌ NOT READY'}`);
  console.log(`Category:     ${result.status}`);
  console.log(`Latency:      ${result.latencyMs}ms`);

  if (result.ready) {
    console.log(`Model Probe:  "${result.rawResponse}"`);
    console.log(`Token Usage:  Prompt=${result.usageMetadata?.promptTokens}, Candidates=${result.usageMetadata?.candidatesTokens}, Total=${result.usageMetadata?.totalTokens}`);
    console.log('\n✅ Live Gemini API is reachable with active quota. Ready for evaluation runs.\n');
  } else {
    console.log(`Error Code:   ${result.errorCode}`);
    console.log(`Message:      ${result.errorMessage}`);
    if (result.retryAfter) {
      console.log(`Retry After:  ${result.retryAfter}`);
    }
    console.log('\n⚠️ Live Gemini API is currently unavailable. Live benchmarks will be paused.\n');
  }

  process.exit(result.ready ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal preflight error:', err);
  process.exit(1);
});

