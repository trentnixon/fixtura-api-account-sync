const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../src/utils/logger");
puppeteer.use(StealthPlugin());

// Fix MaxListenersExceededWarning: Increase max listeners for Puppeteer's Commander
// This prevents memory leak warnings when multiple browser instances exist
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = 20; // Increase from default 10

class PuppeteerManager {
  // Singleton pattern to prevent multiple browser instances
  static instance = null;
  static getInstance() {
    if (!PuppeteerManager.instance) {
      PuppeteerManager.instance = new PuppeteerManager();
      logger.info("PuppeteerManager singleton instance created");
    }
    return PuppeteerManager.instance;
  }

  constructor() {
    // If singleton already exists and this is a direct constructor call, warn but allow it
    // This maintains backward compatibility while encouraging singleton usage
    if (PuppeteerManager.instance && this.constructor === PuppeteerManager) {
      logger.warn(
        "PuppeteerManager: Direct instantiation detected. Consider using PuppeteerManager.getInstance() to share browser instance and save memory."
      );
    }

    this.browser = null;
    this.disposables = [];
    this.operationCount = 0;
    this.maxOperationsBeforeRestart = parseInt(
      process.env.PUPPETEER_MAX_OPS_BEFORE_RESTART || "3",
      10
    ); // Restart every 3 operations by default (very aggressive for single-job memory spikes)
    this.lastRestartTime = Date.now();
    this.minRestartInterval = 15000; // Don't restart more than once per 15 seconds
    this.activePages = new Set(); // Track pages currently in use to prevent restart during operations
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
    // Only check for restart if no pages are currently active
    // This prevents closing pages while they're being used
    if (this.activePages.size === 0) {
      await this.checkAndRestartIfNeeded();
    }

    await this.launchBrowser();
    const page = await this.browser.newPage();

    // Track this page as active
    this.activePages.add(page);

    // Automatically remove from active set when page closes
    page.once("close", () => {
      this.activePages.delete(page);
    });

    // Memory optimization: Set JavaScript heap size limit for this page
    await page.setJavaScriptEnabled(true);

    // Note: Request interception should be set by individual services
    // if needed, to avoid conflicts with multiple handlers

    this.addDisposable(page);
    this.operationCount++;

    // Log memory after page creation
    if (this.operationCount % 5 === 0) {
      const mem = process.memoryUsage();
      logger.info(
        `Page created (op ${this.operationCount}): RSS=${(
          mem.rss /
          1024 /
          1024
        ).toFixed(2)}MB, Heap=${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`
      );
    }

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
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const externalMB = memoryUsage.external / 1024 / 1024;

    // Log memory usage for monitoring
    logger.info(
      `Memory check: RSS=${rssMB.toFixed(2)}MB, Heap=${heapUsedMB.toFixed(
        2
      )}MB/${heapTotalMB.toFixed(2)}MB, External=${externalMB.toFixed(
        2
      )}MB, Ops=${this.operationCount}`
    );

    // Restart if heap exceeds 60MB or RSS exceeds 150MB (very aggressive thresholds for 1GB Heroku limit)
    // Single jobs can create 50+ pages, need to restart more frequently
    if (heapUsedMB > 60 || rssMB > 150) {
      logger.warn(
        `Memory high (heap: ${heapUsedMB.toFixed(2)}MB, RSS: ${rssMB.toFixed(
          2
        )}MB) - restarting browser immediately`
      );
      await this.restartBrowser();
      return;
    }
  }

  /**
   * Force browser restart (bypasses rate limiting and operation count checks)
   * Use this between major processing stages to prevent memory accumulation
   */
  async forceRestartBrowser() {
    logger.info("Force restarting browser between processing stages");
    // Temporarily disable rate limiting
    const originalMinInterval = this.minRestartInterval;
    this.minRestartInterval = 0;
    await this.restartBrowser();
    this.minRestartInterval = originalMinInterval;
  }

  /**
   * Restarts the browser to free memory
   * Closes all pages and the browser, then launches a new one
   * Will NOT restart if there are active pages in use
   */
  async restartBrowser() {
    // Don't restart if pages are actively being used
    if (this.activePages.size > 0) {
      logger.info(
        `Deferring browser restart - ${this.activePages.size} active page(s) in use`
      );
      return;
    }

    try {
      const memoryBefore = process.memoryUsage();
      const rssBeforeMB = memoryBefore.rss / 1024 / 1024;
      logger.info(
        `Restarting browser to free memory (RSS before: ${rssBeforeMB.toFixed(
          2
        )}MB)...`
      );

      // Close all pages first
      if (this.browser) {
        const pages = await this.browser.pages();
        logger.info(`Closing ${pages.length} pages before browser restart`);
        await Promise.all(
          pages.map(async (page) => {
            try {
              if (!page.isClosed()) {
                await page.close();
              }
              // Remove from active set if it was tracked
              this.activePages.delete(page);
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

      // Longer delay to let memory free up
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Launch new browser
      await this.launchBrowser();

      const memoryAfter = process.memoryUsage();
      const rssAfterMB = memoryAfter.rss / 1024 / 1024;
      const freedMB = rssBeforeMB - rssAfterMB;
      logger.info(
        `Browser restarted successfully (RSS after: ${rssAfterMB.toFixed(
          2
        )}MB, freed: ${freedMB.toFixed(2)}MB)`
      );
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
        // Remove from active set
        this.activePages.delete(page);
        logger.debug("Page closed and memory freed");
      }
    } catch (error) {
      logger.warn("Error closing page", { error: error.message });
      // Still remove from active set even if close failed
      this.activePages.delete(page);
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
        // Close all pages first
        try {
          const pages = await this.browser.pages();
          if (pages.length > 0) {
            await Promise.all(
              pages.map(async (page) => {
                try {
                  if (!page.isClosed()) {
                    await page.close();
                  }
                } catch (error) {
                  // Ignore
                }
              })
            );
          }
        } catch (error) {
          // Ignore errors getting pages
        }

        await this.browser.close();
        this.browser = null; // Ensure the reference is cleared
        logger.info("Puppeteer browser closed");
      }
    } catch (error) {
      logger.error("Error closing Puppeteer browser", { error });
      this.browser = null; // Force clear even on error
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats() {
    const mem = process.memoryUsage();
    return {
      rss: (mem.rss / 1024 / 1024).toFixed(2) + " MB",
      heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + " MB",
      heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + " MB",
      external: (mem.external / 1024 / 1024).toFixed(2) + " MB",
      operationCount: this.operationCount,
    };
  }

  addDisposable(disposable) {
    if (
      !disposable ||
      !(
        typeof disposable.dispose === "function" ||
        typeof disposable.close === "function"
      )
    ) {
      return;
    }

    this.disposables.push(disposable);
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
