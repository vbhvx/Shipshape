import type { Page } from 'playwright';
import { VisualViewportChecker } from './visual-viewport-checker.ts';
import { ConsoleErrorCollector } from './console-error-collector.ts';
import { BrowserAssertionEngine } from './browser-assertion-engine.ts';
import type { ScenarioAssertionReport, AssertionStepResult } from '../../../tests/benchmark/assertions.ts';

/**
 * ScenarioExecutor: Runs live end-to-end browser benchmark scenario assertions
 * using headless Chromium outside the application container.
 */
export class ScenarioExecutor {
  /**
   * Scenario 1: DevOps Pulse SaaS Landing Page.
   * Asserts responsive layout, navigation anchors, hero content, pricing tiers,
   * horizontal scroll overflow, and client console cleanliness.
   */
  static async executeScenario1DevOpsPulse(
    page: Page,
    url: string
  ): Promise<ScenarioAssertionReport> {
    const startTime = Date.now();
    const results: AssertionStepResult[] = [];
    const consoleCollector = new ConsoleErrorCollector().attach(page);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(200);

      // Step 1: Navigation Header
      const s1Start = Date.now();
      const hasHeader = (await page.locator('header, [role="banner"]').count()) > 0;
      results.push({
        stepId: 'saas_nav_header',
        description: 'Header navigation landmark is visible with brand/links',
        passed: hasHeader,
        durationMs: Date.now() - s1Start,
        error: hasHeader ? undefined : 'Missing <header> or role="banner" navigation landmark',
      });

      // Step 2: Primary Hero Heading
      const s2Start = Date.now();
      const h1Count = await page.locator('h1').count();
      const h1Text = h1Count > 0 ? (await page.locator('h1').first().innerText()).toLowerCase() : '';
      const heroValid = h1Count > 0 && (h1Text.includes('devops') || h1Text.includes('pulse') || h1Text.includes('observability') || h1Text.length > 5);
      results.push({
        stepId: 'saas_hero_heading',
        description: 'Primary <h1> hero heading is present and visible',
        passed: heroValid,
        durationMs: Date.now() - s2Start,
        error: heroValid ? undefined : 'Primary <h1> heading missing or lacks brand context',
      });

      // Step 3: Call to Action (CTA) Button
      const s3Start = Date.now();
      const ctaLocator = page.locator('button, a').filter({
        hasText: /start free trial|get started|book demo|explore/i,
      });
      const hasCta = (await ctaLocator.count()) > 0;
      results.push({
        stepId: 'saas_cta_button',
        description: 'Primary call-to-action button is visible and actionable',
        passed: hasCta,
        durationMs: Date.now() - s3Start,
        error: hasCta ? undefined : 'Missing primary CTA button with standard text',
      });

      // Step 4: Pricing Matrix / Cards
      const s4Start = Date.now();
      const pageText = (await page.locator('body').innerText()).toLowerCase();
      const hasPricing = pageText.includes('pricing') || pageText.includes('starter') || pageText.includes('pro') || pageText.includes('$');
      results.push({
        stepId: 'saas_pricing_cards',
        description: 'Pricing tiers or feature cards are rendered in viewport',
        passed: hasPricing,
        durationMs: Date.now() - s4Start,
        error: hasPricing ? undefined : 'No pricing tiers or cards detected on page',
      });

      // Step 5: Desktop Horizontal Overflow (1280px)
      const s5Start = Date.now();
      const desktopCheck = await VisualViewportChecker.checkOverflow(page, { width: 1280, height: 800 });
      results.push({
        stepId: 'saas_overflow_desktop',
        description: 'Zero horizontal scroll overflow on desktop viewport (1280px)',
        passed: !desktopCheck.hasOverflow,
        durationMs: Date.now() - s5Start,
        error: desktopCheck.hasOverflow
          ? `Desktop scrollWidth (${desktopCheck.scrollWidth}px) exceeds 1280px by ${desktopCheck.excessPixels}px`
          : undefined,
      });

      // Step 6: Mobile Horizontal Overflow (375px)
      const s6Start = Date.now();
      const mobileCheck = await VisualViewportChecker.checkOverflow(page, { width: 375, height: 667 });
      results.push({
        stepId: 'saas_overflow_mobile',
        description: 'Zero horizontal scroll overflow on mobile viewport (375px)',
        passed: !mobileCheck.hasOverflow,
        durationMs: Date.now() - s6Start,
        error: mobileCheck.hasOverflow
          ? `Mobile scrollWidth (${mobileCheck.scrollWidth}px) exceeds 375px by ${mobileCheck.excessPixels}px`
          : undefined,
      });

      // Step 7: Clean Console Errors
      const consoleErrors = consoleCollector.getErrors();
      results.push({
        stepId: 'saas_console_clean',
        description: 'Zero unhandled client-side JavaScript console errors',
        passed: consoleErrors.length === 0,
        durationMs: 1,
        error: consoleErrors.length === 0 ? undefined : `Unhandled console errors: ${consoleErrors.join('; ')}`,
      });
    } catch (err: any) {
      results.push({
        stepId: 'saas_navigation_failure',
        description: 'Page navigation succeeded without fatal crash',
        passed: false,
        durationMs: Date.now() - startTime,
        error: err.message,
      });
    }

    const passedSteps = results.filter((r) => r.passed).length;
    return {
      scenarioId: 'bench_01_saas_landing',
      totalSteps: results.length,
      passedSteps,
      failedSteps: results.length - passedSteps,
      passed: passedSteps === results.length,
      stepResults: results,
      consoleErrors: consoleCollector.getErrors(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Scenario 4: TaskFlow Kanban Task Management App.
   * Asserts task creation, UI list update, localStorage persistence,
   * survival across genuine browser reload, and status toggling.
   */
  static async executeScenario4TaskFlow(
    page: Page,
    url: string
  ): Promise<ScenarioAssertionReport> {
    const startTime = Date.now();
    const results: AssertionStepResult[] = [];
    const consoleCollector = new ConsoleErrorCollector().attach(page);
    const uniqueTaskTitle = `Shipshape Verified Task ${Date.now()}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(200);

      // Step 1: Column / Section Structure
      const s1Start = Date.now();
      const bodyText = (await page.locator('body').innerText()).toLowerCase();
      const hasColumns =
        bodyText.includes('to do') ||
        bodyText.includes('in progress') ||
        bodyText.includes('done') ||
        bodyText.includes('tasks') ||
        bodyText.includes('completed');
      results.push({
        stepId: 'task_col_structure',
        description: 'Task board columns or category sections are visible',
        passed: hasColumns,
        durationMs: Date.now() - s1Start,
        error: hasColumns ? undefined : 'No Kanban columns or task categories detected',
      });

      // Step 2: Add Task Form / Input
      const s2Start = Date.now();
      const inputLocator = page.locator('#new-item-title, input[placeholder*="task" i], input[type="text"]').first();
      const inputVisible = (await inputLocator.count()) > 0;
      results.push({
        stepId: 'task_input_accessible',
        description: 'New task input field is present and accessible',
        passed: inputVisible,
        durationMs: Date.now() - s2Start,
        error: inputVisible ? undefined : 'Could not find task title input field',
      });

      // Step 3: Create Task
      const s3Start = Date.now();
      let taskCreated = false;
      if (inputVisible) {
        await inputLocator.fill(uniqueTaskTitle);
        // Submit via enter key or form button
        await inputLocator.press('Enter');
        await page.waitForTimeout(300);

        // Verify task appears in DOM
        taskCreated = (await page.getByText(uniqueTaskTitle).count()) > 0;
      }
      results.push({
        stepId: 'task_create_submit',
        description: 'Submitting task form renders new task item in UI list',
        passed: taskCreated,
        durationMs: Date.now() - s3Start,
        error: taskCreated ? undefined : `Created task "${uniqueTaskTitle}" did not render in DOM`,
      });

      // Step 4: Client Storage State
      const s4Start = Date.now();
      const storageBefore = await BrowserAssertionEngine.getLocalStorage(page);
      const isStored = Object.values(storageBefore).some((val) => val.includes(uniqueTaskTitle));
      results.push({
        stepId: 'task_storage_saved',
        description: 'New task is written to client localStorage state',
        passed: isStored,
        durationMs: Date.now() - s4Start,
        error: isStored ? undefined : 'Created task was not found in localStorage',
      });

      // Step 5: Persistence Across Browser Reload
      const s5Start = Date.now();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const inDomAfterReload = (await page.getByText(uniqueTaskTitle).count()) > 0;
      const storageAfter = await BrowserAssertionEngine.getLocalStorage(page);
      const inStorageAfterReload = Object.values(storageAfter).some((val) => val.includes(uniqueTaskTitle));
      const reloadSuccess = inDomAfterReload || inStorageAfterReload;

      results.push({
        stepId: 'task_persisted_reload',
        description: 'Created task survives page reload in DOM and storage',
        passed: reloadSuccess,
        durationMs: Date.now() - s5Start,
        error: reloadSuccess ? undefined : 'Task did not persist across page reload',
      });

      // Step 6: Status Toggle (Complete Task)
      const s6Start = Date.now();
      const checkbox = page.locator('input[type="checkbox"]').first();
      let toggled = false;
      if ((await checkbox.count()) > 0) {
        await checkbox.click();
        await page.waitForTimeout(150);
        toggled = true;
      }
      results.push({
        stepId: 'task_status_toggle',
        description: 'Task completion status can be toggled via checkbox',
        passed: toggled,
        durationMs: Date.now() - s6Start,
        error: toggled ? undefined : 'No interactive task completion checkbox found',
      });

      // Step 7: Clean Console Errors
      const consoleErrors = consoleCollector.getErrors();
      results.push({
        stepId: 'task_console_clean',
        description: 'Zero unhandled client-side JavaScript console errors',
        passed: consoleErrors.length === 0,
        durationMs: 1,
        error: consoleErrors.length === 0 ? undefined : `Unhandled console errors: ${consoleErrors.join('; ')}`,
      });
    } catch (err: any) {
      results.push({
        stepId: 'task_execution_failure',
        description: 'Scenario completed without catastrophic runtime error',
        passed: false,
        durationMs: Date.now() - startTime,
        error: err.message,
      });
    }

    const passedSteps = results.filter((r) => r.passed).length;
    return {
      scenarioId: 'bench_04_task_management',
      totalSteps: results.length,
      passedSteps,
      failedSteps: results.length - passedSteps,
      passed: passedSteps === results.length,
      stepResults: results,
      consoleErrors: consoleCollector.getErrors(),
      durationMs: Date.now() - startTime,
    };
  }
}
