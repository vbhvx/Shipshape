import type { Page, ConsoleMessage } from 'playwright';

export interface ConsoleErrorRecord {
  type: 'console_error' | 'page_error';
  text: string;
  location?: string;
  timestamp: string;
}

/**
 * Captures browser console errors, warnings, and unhandled client-side exceptions
 * during headless test execution.
 */
export class ConsoleErrorCollector {
  private records: ConsoleErrorRecord[] = [];
  private attachedPage: Page | null = null;

  /**
   * Attaches listeners to the given Playwright Page.
   */
  attach(page: Page): this {
    this.attachedPage = page;

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign asset loading noise (such as missing optional favicon)
        if (text.includes('favicon.ico') && text.includes('404')) {
          return;
        }

        this.records.push({
          type: 'console_error',
          text,
          location: msg.location().url,
          timestamp: new Date().toISOString(),
        });
      }
    });

    page.on('pageerror', (err: Error) => {
      this.records.push({
        type: 'page_error',
        text: err.message || String(err),
        location: err.stack,
        timestamp: new Date().toISOString(),
      });
    });

    return this;
  }

  getErrors(): string[] {
    return this.records.map((r) => r.text);
  }

  getDetailedErrors(): ConsoleErrorRecord[] {
    return [...this.records];
  }

  hasErrors(): boolean {
    return this.records.length > 0;
  }

  clear(): void {
    this.records = [];
  }
}
