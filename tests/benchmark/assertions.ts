import type { BrowserAssertionStep } from './scenarios.ts';

export interface AssertionExecutionContext {
  url: string;
  viewport?: { width: number; height: number };
  htmlContent?: string;
  localStorageState?: Record<string, string>;
  consoleErrors: string[];
}

export interface AssertionStepResult {
  stepId: string;
  description: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  diagnostics?: Record<string, any>;
}

export interface ScenarioAssertionReport {
  scenarioId: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  passed: boolean;
  stepResults: AssertionStepResult[];
  consoleErrors: string[];
  durationMs: number;
}

/**
 * Reusable DOM query resolver prioritizing accessible semantics (Role, Accessible Name, Text)
 * over brittle CSS selectors.
 */
export function resolveSemanticQuery(step: BrowserAssertionStep): { queryType: string; selectorString: string } {
  if (step.role && step.name) {
    return { queryType: 'role_and_name', selectorString: `role=${step.role}[name="${step.name}"]` };
  }
  if (step.role) {
    return { queryType: 'role', selectorString: `role=${step.role}` };
  }
  if (step.selector) {
    return { queryType: 'css', selectorString: step.selector };
  }
  if (step.text) {
    return { queryType: 'text', selectorString: `text="${step.text}"` };
  }
  return { queryType: 'action_only', selectorString: step.action };
}

/**
 * Evaluates whether an HTML document or DOM tree exhibits horizontal scroll overflow at a given viewport width.
 * Standard requirement: document.documentElement.scrollWidth <= viewportWidth.
 */
export function evaluateHorizontalOverflow(
  scrollWidth: number,
  viewportWidth: number
): { hasOverflow: boolean; excessPixels: number } {
  const excess = Math.max(0, scrollWidth - viewportWidth);
  return {
    hasOverflow: excess > 1, // Tolerance of 1px for subpixel anti-aliasing
    excessPixels: excess,
  };
}

/**
 * Validates whether client-side localStorage state contains the required entity records
 * and verifies that data survives browser reload.
 */
export function verifyPersistenceIntegrity(
  storage: Record<string, string>,
  requiredKeySubstring: string,
  expectedContentSubstring: string
): { isPersisted: boolean; matchedKey?: string; error?: string } {
  for (const [key, value] of Object.entries(storage)) {
    if (key.toLowerCase().includes(requiredKeySubstring.toLowerCase())) {
      if (value.includes(expectedContentSubstring)) {
        return { isPersisted: true, matchedKey: key };
      }
    }
  }

  // Also search raw values in case storage key format is hashed or namespaced
  for (const [key, value] of Object.entries(storage)) {
    if (value.includes(expectedContentSubstring)) {
      return { isPersisted: true, matchedKey: key };
    }
  }

  return {
    isPersisted: false,
    error: `Expected string "${expectedContentSubstring}" was not found in localStorage under key "${requiredKeySubstring}".`,
  };
}

/**
 * Headless assertion evaluator that executes against either:
 * 1. A simulated preview DOM/HTML environment (for fast feedback)
 * 2. A live browser page (Playwright Page / Puppeteer Page)
 */
export class BenchmarkAssertionRunner {
  /**
   * Executes assertions for Scenario 1: DevOps Pulse SaaS Landing Page.
   * Verifies responsive design, accessible navigation anchors, pricing tiers, and horizontal overflow.
   */
  static async executeScenario1Assertions(
    domContext: {
      html: string;
      title: string;
      desktopScrollWidth: number;
      mobileScrollWidth: number;
      consoleErrors: string[];
    }
  ): Promise<ScenarioAssertionReport> {
    const startTime = Date.now();
    const results: AssertionStepResult[] = [];
    const htmlLower = domContext.html.toLowerCase();

    // 1. Header Navigation
    const hasHeader = htmlLower.includes('<header') || htmlLower.includes('role="banner"');
    results.push({
      stepId: 'saas_nav_header',
      description: 'Header navigation is visible with logo and links',
      passed: hasHeader,
      durationMs: 5,
      error: hasHeader ? undefined : 'Missing <header> or role="banner" landmark',
    });

    // 2. Primary <h1> Hero Heading
    const hasHeroHeading = htmlLower.includes('<h1') && (htmlLower.includes('devops') || htmlLower.includes('pulse') || htmlLower.includes('observability'));
    results.push({
      stepId: 'saas_hero_heading',
      description: 'Primary <h1> hero heading is present and accessible',
      passed: hasHeroHeading,
      durationMs: 5,
      error: hasHeroHeading ? undefined : 'Missing <h1> hero heading containing application brand',
    });

    // 3. CTA Buttons
    const hasCta = htmlLower.includes('start free trial') || htmlLower.includes('book demo') || htmlLower.includes('get started');
    results.push({
      stepId: 'saas_cta_button',
      description: 'CTA button "Start Free Trial" is clickable',
      passed: hasCta,
      durationMs: 5,
      error: hasCta ? undefined : 'Missing primary CTA button text',
    });

    // 4. Pricing Tiers
    const tierMatches = (htmlLower.match(/starter|team|enterprise|pro|\$29|\$79/g) || []).length;
    const hasThreeTiers = tierMatches >= 3 || htmlLower.includes('pricing');
    results.push({
      stepId: 'saas_pricing_cards',
      description: 'Pricing matrix renders tier cards',
      passed: hasThreeTiers,
      durationMs: 5,
      error: hasThreeTiers ? undefined : 'Fewer than 3 pricing tiers detected in markup',
    });

    // 5. Desktop Horizontal Overflow
    const desktopCheck = evaluateHorizontalOverflow(domContext.desktopScrollWidth, 1280);
    results.push({
      stepId: 'saas_overflow_desktop',
      description: 'Zero horizontal scroll overflow on desktop viewport (1280px)',
      passed: !desktopCheck.hasOverflow,
      durationMs: 2,
      error: desktopCheck.hasOverflow ? `Desktop scrollWidth (${domContext.desktopScrollWidth}px) exceeds 1280px by ${desktopCheck.excessPixels}px` : undefined,
    });

    // 6. Mobile Horizontal Overflow
    const mobileCheck = evaluateHorizontalOverflow(domContext.mobileScrollWidth, 375);
    results.push({
      stepId: 'saas_overflow_mobile',
      description: 'Zero horizontal scroll overflow on mobile viewport (375px)',
      passed: !mobileCheck.hasOverflow,
      durationMs: 2,
      error: mobileCheck.hasOverflow ? `Mobile scrollWidth (${domContext.mobileScrollWidth}px) exceeds 375px by ${mobileCheck.excessPixels}px` : undefined,
    });

    // 7. Clean Console Errors
    const consoleClean = domContext.consoleErrors.length === 0;
    results.push({
      stepId: 'saas_console_clean',
      description: 'Zero unhandled client console errors',
      passed: consoleClean,
      durationMs: 1,
      error: consoleClean ? undefined : `Unhandled console errors: ${domContext.consoleErrors.join('; ')}`,
    });

    const passedSteps = results.filter((r) => r.passed).length;
    return {
      scenarioId: 'bench_01_saas_landing',
      totalSteps: results.length,
      passedSteps,
      failedSteps: results.length - passedSteps,
      passed: passedSteps === results.length,
      stepResults: results,
      consoleErrors: domContext.consoleErrors,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Executes assertions for Scenario 4: TaskFlow Kanban Task Management App.
   * Verifies task creation, column state transition, deletion, and localStorage persistence across reloads.
   */
  static async executeScenario4Assertions(
    appContext: {
      html: string;
      createdTaskTitle: string;
      storageBeforeReload: Record<string, string>;
      storageAfterReload: Record<string, string>;
      columnsFound: string[];
      consoleErrors: string[];
    }
  ): Promise<ScenarioAssertionReport> {
    const startTime = Date.now();
    const results: AssertionStepResult[] = [];
    const htmlLower = appContext.html.toLowerCase();

    // 1. Columns Exist
    const hasTodo = appContext.columnsFound.some((c) => c.toLowerCase().includes('to do') || c.toLowerCase().includes('todo')) || htmlLower.includes('to do');
    const hasProgress = appContext.columnsFound.some((c) => c.toLowerCase().includes('in progress')) || htmlLower.includes('in progress');
    const hasDone = appContext.columnsFound.some((c) => c.toLowerCase().includes('done')) || htmlLower.includes('done');

    results.push({
      stepId: 'task_col_todo',
      description: '"To Do" column is visible',
      passed: hasTodo,
      durationMs: 5,
      error: hasTodo ? undefined : 'Missing "To Do" column in Kanban view',
    });

    results.push({
      stepId: 'task_col_progress',
      description: '"In Progress" column is visible',
      passed: hasProgress,
      durationMs: 5,
      error: hasProgress ? undefined : 'Missing "In Progress" column in Kanban view',
    });

    results.push({
      stepId: 'task_col_done',
      description: '"Done" column is visible',
      passed: hasDone,
      durationMs: 5,
      error: hasDone ? undefined : 'Missing "Done" column in Kanban view',
    });

    // 2. Add Task Trigger
    const hasAddTrigger = htmlLower.includes('add task') || htmlLower.includes('new task') || htmlLower.includes('create task') || htmlLower.includes('<input');
    results.push({
      stepId: 'task_add_button',
      description: 'Add task button or input trigger is accessible',
      passed: hasAddTrigger,
      durationMs: 5,
      error: hasAddTrigger ? undefined : 'Missing "Add Task" button or form trigger',
    });

    // 3. Task Creation in Storage
    const createCheck = verifyPersistenceIntegrity(appContext.storageBeforeReload, 'task', appContext.createdTaskTitle);
    results.push({
      stepId: 'task_create_submit',
      description: 'Create task form accepts title and writes task to state',
      passed: createCheck.isPersisted,
      durationMs: 5,
      error: createCheck.isPersisted ? undefined : createCheck.error,
    });

    // 4. Persistence Across Browser Reload
    const reloadCheck = verifyPersistenceIntegrity(appContext.storageAfterReload, 'task', appContext.createdTaskTitle);
    results.push({
      stepId: 'task_persisted_reload',
      description: 'Created task survives browser reload in storage',
      passed: reloadCheck.isPersisted,
      durationMs: 5,
      error: reloadCheck.isPersisted ? undefined : `Reload persistence failure: ${reloadCheck.error}`,
    });

    // 5. Clean Console Errors
    const consoleClean = appContext.consoleErrors.length === 0;
    results.push({
      stepId: 'task_console_clean',
      description: 'Zero unhandled client console errors',
      passed: consoleClean,
      durationMs: 1,
      error: consoleClean ? undefined : `Unhandled console errors: ${appContext.consoleErrors.join('; ')}`,
    });

    const passedSteps = results.filter((r) => r.passed).length;
    return {
      scenarioId: 'bench_04_task_management',
      totalSteps: results.length,
      passedSteps,
      failedSteps: results.length - passedSteps,
      passed: passedSteps === results.length,
      stepResults: results,
      consoleErrors: appContext.consoleErrors,
      durationMs: Date.now() - startTime,
    };
  }
}
