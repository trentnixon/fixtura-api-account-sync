const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../src/utils/logger");
const { setupPage } = require("./pageSetup");
const { getMemoryStats, formatMemoryStats } = require("./memoryUtils");
const { closePagesSafely, getPagesSafely } = require("./pageUtils");
const { BROWSER_CONFIG, MEMORY_CONFIG, isDevelopment } = require("./constants");

puppeteer.use(StealthPlugin());

// Fix MaxListenersExceededWarning: Increase max listeners for Puppeteer's Commander
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = BROWSER_CONFIG.MAX_LISTENERS;

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
    this.maxOperationsBeforeRestart =
      MEMORY_CONFIG.MAX_OPERATIONS_BEFORE_RESTART;
    this.lastRestartTime = Date.now();
    this.minRestartInterval = MEMORY_CONFIG.MIN_RESTART_INTERVAL;
    this.activePages = new Set();
    this.currentProxyPortIndex = 0;
  }

  /**
   * Get proxy configuration with port rotation support
   * @returns {Object|null} Proxy config with server, username, password or null if disabled
   */
  _getProxyConfig() {
    const { PROXY_CONFIG } = require("../../src/config/environment");
    const {
      isProxyConfigValid,
      getProxyServerUrl,
    } = require("../../src/config/proxyConfig");

    if (!isProxyConfigValid(PROXY_CONFIG)) {
      return null; // No proxy configured
    }

    // Select port (rotate if multiple ports available)
    const portIndex = this.currentProxyPortIndex % PROXY_CONFIG.ports.length;
    const selectedPort = PROXY_CONFIG.ports[portIndex];
    const proxyServer = getProxyServerUrl(PROXY_CONFIG.host, selectedPort);

    return {
      server: proxyServer,
      host: PROXY_CONFIG.host,
      port: selectedPort,
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password,
      hasMultiplePorts: PROXY_CONFIG.ports.length > 1,
      totalPorts: PROXY_CONFIG.ports.length,
    };
  }

  /**
   * Rotate to next proxy port (called on browser restart if rotation enabled)
   */
  _rotateProxyPort() {
    const { PROXY_CONFIG } = require("../../src/config/environment");

    if (
      PROXY_CONFIG.enabled &&
      PROXY_CONFIG.rotateOnRestart &&
      PROXY_CONFIG.ports.length > 1
    ) {
      this.currentProxyPortIndex =
        (this.currentProxyPortIndex + 1) % PROXY_CONFIG.ports.length;
      logger.info(
        `Proxy port rotated to: ${PROXY_CONFIG.host}:${
          PROXY_CONFIG.ports[this.currentProxyPortIndex]
        } (${this.currentProxyPortIndex + 1}/${PROXY_CONFIG.ports.length})`
      );
    }
  }

  async launchBrowser() {
    if (this.browser) {
      // Browser is already launched, so just return.
      return;
    }

    // Rotate proxy port if enabled (before launching new browser)
    this._rotateProxyPort();

    // Get proxy configuration
    const proxyConfig = this._getProxyConfig();
    const { getLaunchOptions } = require("./browserConfig");

    try {
      const launchOptions = getLaunchOptions({
        headless: !isDevelopment(),
        proxyServer: proxyConfig ? proxyConfig.server : null,
        protocolTimeout: BROWSER_CONFIG.PROTOCOL_TIMEOUT,
      });

      if (proxyConfig) {
        logger.info("Puppeteer browser launching with Decodo proxy", {
          proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          portRotation: proxyConfig.hasMultiplePorts
            ? `${proxyConfig.totalPorts} ports available`
            : "single port",
        });
      }

      this.browser = await puppeteer.launch(launchOptions);

      logger.info("Puppeteer browser launched", {
        proxyEnabled: proxyConfig !== null,
      });
    } catch (error) {
      logger.error("Error launching Puppeteer browser", { error });

      // If proxy was enabled and launch failed, try without proxy as fallback
      if (proxyConfig) {
        logger.warn(
          "Browser launch with proxy failed, retrying without proxy",
          { error: error.message }
        );
        try {
          const fallbackOptions = getLaunchOptions({
            headless: !isDevelopment(),
            proxyServer: null,
            protocolTimeout: BROWSER_CONFIG.PROTOCOL_TIMEOUT,
          });

          this.browser = await puppeteer.launch(fallbackOptions);
          logger.warn("Browser launched without proxy (fallback mode)");
        } catch (fallbackError) {
          logger.error("Browser launch failed even without proxy", {
            error: fallbackError,
          });
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  async createPageInNewContext() {
    // Only check for restart if no pages are currently active
    if (this.activePages.size === 0) {
      await this.checkAndRestartIfNeeded();
    }

    await this.launchBrowser();
    const page = await this.browser.newPage();

    // Track this page as active
    this.activePages.add(page);
    page.once("close", () => {
      this.activePages.delete(page);
    });

    // Set up page with default configurations
    const proxyConfig = this._getProxyConfig();
    await setupPage(page, proxyConfig);

    this.addDisposable(page);
    this.operationCount++;

    // Log memory periodically
    if (this.operationCount % MEMORY_CONFIG.MEMORY_LOG_INTERVAL === 0) {
      const stats = getMemoryStats();
      logger.info(
        `Page created (op ${this.operationCount}): RSS=${stats.rss.toFixed(
          2
        )}MB, Heap=${stats.heapUsed.toFixed(2)}MB`
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

    // Check memory usage
    const stats = getMemoryStats();
    const shouldLogMemory =
      this.operationCount % MEMORY_CONFIG.MEMORY_CHECK_INTERVAL === 0 ||
      stats.heapUsed > MEMORY_CONFIG.MEMORY_WARNING_HEAP_MB ||
      stats.rss > MEMORY_CONFIG.MEMORY_WARNING_RSS_MB;

    if (shouldLogMemory) {
      logger.info(
        `Memory check: ${formatMemoryStats(stats)}, Ops=${this.operationCount}`
      );
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
      const statsBefore = getMemoryStats();
      logger.info(
        `Restarting browser to free memory (RSS before: ${statsBefore.rss.toFixed(
          2
        )}MB)...`
      );

      // Close all pages first
      if (this.browser) {
        const pages = await getPagesSafely(this.browser);
        if (pages.length > 0) {
          logger.info(`Closing ${pages.length} pages before browser restart`);
          await closePagesSafely(pages);
          // Remove from active set
          pages.forEach((page) => this.activePages.delete(page));
        }
      }

      // Close browser
      await this.closeBrowser();

      // Reset counters
      this.operationCount = 0;
      this.lastRestartTime = Date.now();
      this.disposables = [];

      // Delay to let memory free up
      await new Promise((resolve) =>
        setTimeout(resolve, BROWSER_CONFIG.RESTART_DELAY)
      );

      // Launch new browser
      await this.launchBrowser();

      const statsAfter = getMemoryStats();
      const freedMB = statsBefore.rss - statsAfter.rss;
      logger.info(
        `Browser restarted successfully (RSS after: ${statsAfter.rss.toFixed(
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
    const closed = await require("./pageUtils").closePageSafely(page);
    this.activePages.delete(page);
    if (closed) {
      logger.debug("Page closed and memory freed");
    }
  }

  /**
   * Cleanup orphaned pages that might be accumulating
   * Call this periodically during long-running operations
   */
  async cleanupOrphanedPages() {
    if (!this.browser) return;

    const pages = await getPagesSafely(this.browser);
    // Keep only the first page (default), close others
    if (pages.length > 1) {
      const pagesToClose = pages.slice(1);
      const closedCount = await closePagesSafely(pagesToClose);
      if (closedCount > 0) {
        logger.info(`Cleaned up ${closedCount} orphaned pages`);
      }
    }
  }

  async closeBrowser() {
    if (!this.browser) return;

    try {
      // Close all pages first
      const pages = await getPagesSafely(this.browser);
      if (pages.length > 0) {
        await closePagesSafely(pages);
      }

      await this.browser.close();
      this.browser = null;
      logger.info("Puppeteer browser closed");
    } catch (error) {
      logger.error("Error closing Puppeteer browser", { error });
      this.browser = null;
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats() {
    const stats = getMemoryStats();
    return {
      rss: stats.rss.toFixed(2) + " MB",
      heapTotal: stats.heapTotal.toFixed(2) + " MB",
      heapUsed: stats.heapUsed.toFixed(2) + " MB",
      external: stats.external.toFixed(2) + " MB",
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
    // Close all pages first
    if (this.browser) {
      const pages = await getPagesSafely(this.browser);
      await closePagesSafely(pages);
    }

    // Dispose of registered disposables
    for (const disposable of this.disposables) {
      try {
        if (disposable?.dispose && typeof disposable.dispose === "function") {
          await disposable.dispose();
        } else if (
          disposable?.close &&
          typeof disposable.close === "function"
        ) {
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
