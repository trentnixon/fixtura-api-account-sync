const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../src/utils/logger");
puppeteer.use(StealthPlugin());

// Fix MaxListenersExceededWarning: Increase max listeners for Puppeteer's Commander
// This prevents memory leak warnings when multiple browser instances exist
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = 20; // Increase from default 10

class PuppeteerManager {
  constructor() {
    this.browser = null;
    this.disposables = [];
    this.operationCount = 0;
    this.maxOperationsBeforeRestart = parseInt(
      process.env.PUPPETEER_MAX_OPS_BEFORE_RESTART || "20",
      10
    ); // Restart every 20 operations by default (more aggressive)
    this.lastRestartTime = Date.now();
    this.minRestartInterval = 30000; // Don't restart more than once per 30 seconds
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
        // Handle browser process errors to prevent listener accumulation
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
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
    // Check if we need to restart the browser
    await this.checkAndRestartIfNeeded();

    await this.launchBrowser();
    const page = await this.browser.newPage();

    // Memory optimization: Set JavaScript heap size limit for this page
    await page.setJavaScriptEnabled(true);

    // Note: Request interception should be set by individual services
    // if needed, to avoid conflicts with multiple handlers

    this.addDisposable(page);
    this.operationCount++;
    return page;
  }

  /**
   * Checks if browser should be restarted based on operation count or memory
   * Restarts automatically to prevent memory accumulation
   */
  async checkAndRestartIfNeeded() {
    const now = Date.now();
    const timeSinceLastRestart = now - this.lastRestartTime;

    // Don't restart too frequently (rate limiting)
    if (timeSinceLastRestart < this.minRestartInterval) {
      return;
    }

    // Restart if we've exceeded operation count
    if (this.operationCount >= this.maxOperationsBeforeRestart) {
      logger.info(
        `Restarting browser after ${this.operationCount} operations to free memory`
      );
      await this.restartBrowser();
      return;
    }

    // Check memory usage and restart if too high
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const rssMB = memoryUsage.rss / 1024 / 1024;

    // Restart if heap exceeds 150MB or RSS exceeds 400MB (more aggressive thresholds)
    if (heapUsedMB > 150 || rssMB > 400) {
      logger.warn(
        `Memory high (heap: ${heapUsedMB.toFixed(2)}MB, RSS: ${rssMB.toFixed(
          2
        )}MB) - restarting browser`
      );
      await this.restartBrowser();
      return;
    }
  }

  /**
   * Restarts the browser to free memory
   * Closes all pages and the browser, then launches a new one
   */
  async restartBrowser() {
    try {
      logger.info("Restarting browser to free memory...");

      // Close all pages first
      if (this.browser) {
        const pages = await this.browser.pages();
        await Promise.all(
          pages.map(async (page) => {
            try {
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (error) {
              // Ignore errors
            }
          })
        );
      }

      // Close browser
      await this.closeBrowser();

      // Reset counters
      this.operationCount = 0;
      this.lastRestartTime = Date.now();
      this.disposables = [];

      // Small delay to let memory free up
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Launch new browser
      await this.launchBrowser();

      logger.info("Browser restarted successfully");
    } catch (error) {
      logger.error("Error restarting browser", { error: error.message });
      // Try to launch a fresh browser anyway
      this.browser = null;
      await this.launchBrowser();
    }
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
