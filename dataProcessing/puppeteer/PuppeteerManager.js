const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../src/utils/logger");
puppeteer.use(StealthPlugin());

class PuppeteerManager {
  constructor() {
    this.browser = null;
    this.disposables = [];
  }

  async launchBrowser() {
    if (this.browser) {
      // Browser is already launched, so just return.
      return;
    }
    try {
      this.browser = await puppeteer.launch({
        headless:
          process.env.NODE_ENV && process.env.NODE_ENV.trim() === "development"
            ? false
            : true,
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-features=IsolateOrigins,site-per-process",
          // Memory optimizations (safe for bot detection - don't trigger flags)
          "--disable-gpu", // Reduces memory usage
          "--disable-software-rasterizer", // Saves memory
          "--disable-extensions", // Reduces memory footprint
          "--disable-plugins", // Saves memory
          "--disable-sync", // Reduces background processes
          "--disable-background-timer-throttling", // Prevents memory leaks
          "--disable-backgrounding-occluded-windows", // Memory optimization
          "--disable-renderer-backgrounding", // Prevents memory accumulation
          "--disable-blink-features=AutomationControlled", // Hide automation (testing if safe)
          "--disable-images", // Disable images to save memory
          "--blink-settings=imagesEnabled=false", // Disable images in Blink engine
          "--disable-component-extensions-with-background-pages", // Reduces extension overhead
          "--disable-ipc-flooding-protection", // Better for automation
          "--metrics-recording-only", // Reduce telemetry overhead
          "--mute-audio", // Disable audio processing
          "--disable-notifications", // Prevent notification pop-ups
          "--disable-default-apps", // Don't load default apps
        ],
      });
      logger.info("Puppeteer browser launched");
    } catch (error) {
      logger.error("Error launching Puppeteer browser", { error });
      throw error;
    }
  }

  async createPageInNewContext() {
    await this.launchBrowser();
    const page = await this.browser.newPage();

    // Memory optimization: Set JavaScript heap size limit for this page
    await page.setJavaScriptEnabled(true);

    // Note: Request interception should be set by individual services
    // if needed, to avoid conflicts with multiple handlers

    this.addDisposable(page);
    return page;
  }

  /**
   * Closes a specific page and frees its memory
   * Call this after you're done with a page to prevent memory leaks
   */
  async closePage(page) {
    try {
      if (page && !page.isClosed()) {
        await page.close();
        logger.debug("Page closed and memory freed");
      }
    } catch (error) {
      logger.warn("Error closing page", { error: error.message });
    }
  }

  /**
   * Cleanup orphaned pages that might be accumulating
   * Call this periodically during long-running operations
   */
  async cleanupOrphanedPages() {
    try {
      if (!this.browser) return;

      const pages = await this.browser.pages();
      // Keep only the first page (default), close others
      if (pages.length > 1) {
        const pagesToClose = pages.slice(1);
        await Promise.all(
          pagesToClose.map(async (page) => {
            try {
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (error) {
              // Ignore errors for already closed pages
            }
          })
        );
        logger.info(`Cleaned up ${pagesToClose.length} orphaned pages`);
      }
    } catch (error) {
      logger.warn("Error cleaning up orphaned pages", {
        error: error.message,
      });
    }
  }

  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null; // Ensure the reference is cleared
        logger.info("Puppeteer browser closed");
      }
    } catch (error) {
      logger.error("Error closing Puppeteer browser", { error });
    }
  }

  addDisposable(disposable) {
    if (disposable && typeof disposable.dispose === "function") {
      this.disposables.push(disposable);
    }
  }

  async dispose() {
    // Close all pages first to free memory
    try {
      const pages = await this.browser?.pages();
      if (pages && pages.length > 0) {
        await Promise.all(
          pages.map(async (page) => {
            try {
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (pageError) {
              logger.warn(`Error closing page: ${pageError.message}`);
            }
          })
        );
      }
    } catch (pagesError) {
      logger.warn(`Error getting pages: ${pagesError.message}`);
    }

    // Dispose of registered disposables
    for (const disposable of this.disposables) {
      try {
        if (disposable && typeof disposable.dispose === "function") {
          await disposable.dispose();
        } else if (disposable && typeof disposable.close === "function") {
          // If it's a page, close it
          await disposable.close();
        }
      } catch (error) {
        logger.warn("Error disposing resource", { error: error.message });
      }
    }
    this.disposables = [];

    // Close browser
    await this.closeBrowser();

    // Force garbage collection hint (if available)
    if (global.gc) {
      global.gc();
    }
  }
}

module.exports = PuppeteerManager;
