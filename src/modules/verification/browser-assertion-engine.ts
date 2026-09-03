import type { Page, Locator } from 'playwright';

export interface AssertionStepResult {
  stepId: string;
  description: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  diagnostics?: Record<string, any>;
}

/**
 * BrowserAssertionEngine: Executes semantic assertions and interactive flows
 * against real DOM nodes in a running Playwright browser session.
 */
export class BrowserAssertionEngine {
  /**
   * Asserts an element with specific accessible role and optional accessible name is visible.
   */
  static async assertRoleVisible(
    page: Page,
    role: any,
    name?: string | RegExp,
    options?: { timeout?: number }
  ): Promise<{ passed: boolean; locator: Locator; error?: string }> {
    const timeout = options?.timeout ?? 3000;
    try {
      const locator = name ? page.getByRole(role, { name }) : page.getByRole(role);
      await locator.first().waitFor({ state: 'visible', timeout });
      return { passed: true, locator };
    } catch (err: any) {
      return {
        passed: false,
        locator: page.locator('body'),
        error: `Element with role="${role}" ${name ? `name="${name}"` : ''} not visible within ${timeout}ms: ${err.message}`,
      };
    }
  }

  /**
   * Asserts that text content is visible within the page body.
   */
  static async assertTextVisible(
    page: Page,
    text: string | RegExp,
    options?: { timeout?: number }
  ): Promise<{ passed: boolean; error?: string }> {
    const timeout = options?.timeout ?? 3000;
    try {
      const locator = page.getByText(text);
      await locator.first().waitFor({ state: 'visible', timeout });
      return { passed: true };
    } catch (err: any) {
      return {
        passed: false,
        error: `Text "${text}" not visible within ${timeout}ms: ${err.message}`,
      };
    }
  }

  /**
   * Clicks an accessible role element (button, link, tab).
   */
  static async clickRole(
    page: Page,
    role: any,
    name?: string | RegExp,
    options?: { timeout?: number }
  ): Promise<{ passed: boolean; error?: string }> {
    const timeout = options?.timeout ?? 3000;
    try {
      const locator = name ? page.getByRole(role, { name }) : page.getByRole(role);
      await locator.first().click({ timeout });
      return { passed: true };
    } catch (err: any) {
      return {
        passed: false,
        error: `Failed to click element with role="${role}" ${name ? `name="${name}"` : ''}: ${err.message}`,
      };
    }
  }

  /**
   * Fills an input element by placeholder, label, or css selector.
   */
  static async fillInput(
    page: Page,
    selectorOrLabel: string,
    value: string,
    options?: { timeout?: number }
  ): Promise<{ passed: boolean; error?: string }> {
    const timeout = options?.timeout ?? 3000;
    try {
      if (selectorOrLabel.startsWith('#') || selectorOrLabel.startsWith('.')) {
        await page.locator(selectorOrLabel).fill(value, { timeout });
      } else {
        const byLabel = page.getByLabel(selectorOrLabel);
        if (await byLabel.count() > 0) {
          await byLabel.first().fill(value, { timeout });
        } else {
          await page.getByPlaceholder(selectorOrLabel).first().fill(value, { timeout });
        }
      }
      return { passed: true };
    } catch (err: any) {
      return {
        passed: false,
        error: `Failed to fill input "${selectorOrLabel}": ${err.message}`,
      };
    }
  }

  /**
   * Extracts all key-value entries from window.localStorage.
   */
  static async getLocalStorage(page: Page): Promise<Record<string, string>> {
    return page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items[key] = localStorage.getItem(key) || '';
        }
      }
      return items;
    });
  }

  /**
   * Verifies that data in localStorage survives browser reload.
   */
  static async verifyReloadPersistence(
    page: Page,
    keySubstr: string,
    expectedContent: string
  ): Promise<{ isPersisted: boolean; matchedKey?: string; error?: string }> {
    // 1. Read storage before reload
    const _storageBefore = await this.getLocalStorage(page);

    // 2. Perform genuine browser reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(150);

    // 3. Read storage after reload
    const storageAfter = await this.getLocalStorage(page);

    for (const [key, val] of Object.entries(storageAfter)) {
      if (key.toLowerCase().includes(keySubstr.toLowerCase()) || val.includes(expectedContent)) {
        if (val.includes(expectedContent)) {
          return { isPersisted: true, matchedKey: key };
        }
      }
    }

    return {
      isPersisted: false,
      error: `Data matching "${expectedContent}" was not found in localStorage after page reload. Stored keys: ${Object.keys(storageAfter).join(', ')}`,
    };
  }
}
