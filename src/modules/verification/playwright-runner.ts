import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page, BrowserContextOptions } from 'playwright';

export interface RunnerLaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
}

/**
 * Manages headless Chromium browser lifecycle for empirical functional verification.
 * Operates independently from the application and container being evaluated.
 */
export class PlaywrightRunner {
  private browser: Browser | null = null;
  private activePages: Page[] = [];

  /**
   * Probes whether the Playwright Chromium browser is available on the host.
   */
  static async isBrowserAvailable(): Promise<boolean> {
    try {
      const browser = await chromium.launch({
        headless: true,
      });
      await browser.close();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Launches headless Chromium instance.
   */
  async launch(options?: RunnerLaunchOptions): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      headless: options?.headless ?? true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    return this.browser;
  }

  /**
   * Creates an isolated browser context with specified viewport and user agent.
   */
  async createContext(options?: BrowserContextOptions): Promise<BrowserContext> {
    if (!this.browser) {
      await this.launch();
    }

    const defaultViewport = { width: 1280, height: 800 };
    return this.browser!.newContext({
      viewport: options?.viewport || defaultViewport,
      userAgent:
        options?.userAgent ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ShipshapeVerifier/1.0',
      ...options,
    });
  }

  /**
   * Spawns a new page in a fresh isolated context.
   */
  async createPage(contextOptions?: BrowserContextOptions): Promise<Page> {
    const context = await this.createContext(contextOptions);
    const page = await context.newPage();
    this.activePages.push(page);
    return page;
  }

  /**
   * Closes all open pages, contexts, and browser instance cleanly.
   */
  async close(): Promise<void> {
    for (const page of this.activePages) {
      try {
        await page.close();
      } catch {
        // Best effort
      }
    }
    this.activePages = [];

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Best effort
      }
      this.browser = null;
    }
  }
}
