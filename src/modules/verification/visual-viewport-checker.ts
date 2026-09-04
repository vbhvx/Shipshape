import type { Page } from 'playwright';

export interface OverflowResult {
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  clientWidth: number;
  hasOverflow: boolean;
  excessPixels: number;
}

export interface ResponsiveReport {
  desktop: OverflowResult;
  mobile: OverflowResult;
  passed: boolean;
}

/**
 * Visual Viewport Checker: Validates responsive design adherence and detects
 * horizontal scrollbar regressions across standard desktop and mobile viewports.
 */
export class VisualViewportChecker {
  /**
   * Checks whether the current page exhibits horizontal overflow at a designated viewport dimension.
   */
  static async checkOverflow(
    page: Page,
    viewport: { width: number; height: number }
  ): Promise<OverflowResult> {
    await page.setViewportSize(viewport);
    // Allow brief settle for CSS flex/grid layout recalculations
    await page.waitForTimeout(100);

    const dims = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        windowWidth: window.innerWidth,
      };
    });

    const excessPixels = Math.max(0, dims.scrollWidth - viewport.width);
    // 1px threshold tolerates floating-point subpixel rounding
    const hasOverflow = excessPixels > 1;

    return {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      scrollWidth: dims.scrollWidth,
      clientWidth: dims.clientWidth,
      hasOverflow,
      excessPixels,
    };
  }

  /**
   * Evaluates layout responsiveness across desktop (1280x800) and mobile (375x667).
   */
  static async checkResponsive(page: Page): Promise<ResponsiveReport> {
    const desktop = await this.checkOverflow(page, { width: 1280, height: 800 });
    const mobile = await this.checkOverflow(page, { width: 375, height: 667 });

    return {
      desktop,
      mobile,
      passed: !desktop.hasOverflow && !mobile.hasOverflow,
    };
  }
}
