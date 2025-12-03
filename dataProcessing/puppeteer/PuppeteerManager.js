const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../src/utils/logger");
const { closePagesSafely, getPagesSafely } = require("./pageUtils");
const { PARALLEL_CONFIG, BROWSER_CONFIG } = require("./constants");

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

    this.disposables = [];
    this.activePages = new Set();
    // Memory monitor (extracted for better organization)
    const MemoryMonitor = require("./utils/MemoryMonitor");
    this.memoryMonitor = new MemoryMonitor();
    // Circuit breaker for proxy failures (must be created before BrowserLifecycleManager)
    const CircuitBreaker = require("./circuitBreaker");
    // Circuit breaker opens after 5 consecutive failures, waits 60 seconds before half-open
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    // Proxy configuration manager (extracted for better organization)
    const ProxyConfigManager = require("./utils/ProxyConfigManager");
    this.proxyConfigManager = new ProxyConfigManager();
    // Browser lifecycle manager (extracted for better organization)
    const BrowserLifecycleManager = require("./utils/BrowserLifecycleManager");
    this.browserLifecycleManager = new BrowserLifecycleManager(
      this.circuitBreaker,
      this.proxyConfigManager
    );
    // Expose browser property for backward compatibility
    Object.defineProperty(this, "browser", {
      get: () => this.browserLifecycleManager.getBrowser(),
    });
    // Page factory (extracted for better organization)
    const PageFactory = require("./utils/PageFactory");
    this.pageFactory = new PageFactory(
      this.browserLifecycleManager,
      this.proxyConfigManager,
      this.memoryMonitor,
      this.activePages,
      this.disposables
    );
    // Reusable page manager (extracted for better organization)
    const ReusePageManager = require("./utils/ReusePageManager");
    this.reusePageManager = new ReusePageManager(
      this.activePages,
      () => this.createPageInNewContext(), // createPageCallback
      (page) => this.closePage(page) // closePageCallback
    );
    // Page pool manager (extracted for better organization)
    const PagePoolManager = require("./utils/PagePoolManager");
    this.maxPagePoolSize = PARALLEL_CONFIG.PAGE_POOL_SIZE; // Maximum pages in parallel pool
    this.pagePoolManager = new PagePoolManager(
      this.browserLifecycleManager,
      this.proxyConfigManager,
      this.memoryMonitor,
      this.activePages,
      this.disposables,
      this.maxPagePoolSize
    );
    // Expose pagePool property for backward compatibility
    Object.defineProperty(this, "pagePool", {
      get: () => this.pagePoolManager.getPagePool(),
    });
    // Proxy error handler (extracted for better organization)
    const ProxyErrorHandler = require("./utils/ProxyErrorHandler");
    this.proxyErrorHandler = new ProxyErrorHandler(
      this.circuitBreaker,
      this.proxyConfigManager,
      this.pagePool // Pass pagePool reference directly (via getter)
    );
  }

  /**
   * Get proxy configuration with port rotation support
   * Delegates to ProxyConfigManager
   * @returns {Object|null} Proxy config with server, username, password or null if disabled
   */
  _getProxyConfig() {
    return this.proxyConfigManager.getConfig();
  }

  /**
   * Rotate to next proxy port (called on browser restart if rotation enabled)
   * Delegates to ProxyConfigManager
   */
  _rotateProxyPort() {
    this.proxyConfigManager.rotatePort();
  }

  /**
   * Launch browser with proxy support and circuit breaker protection
   * Delegates to BrowserLifecycleManager
   * @returns {Promise<void>}
   */
  async launchBrowser() {
    await this.browserLifecycleManager.launch();
  }

  /**
   * Create a new page in a new context
   * Delegates to PageFactory with restart check and rate limit handling
   * @returns {Promise<Page>} Created and configured page
   */
  async createPageInNewContext() {
    // Check if we're in rate limit backoff
    await this.proxyErrorHandler.waitForBackoff();

    // Only check for restart if no pages are currently active
    // Do this AFTER launchBrowser to avoid unnecessary checks
    const checkRestart = this.activePages.size === 0;
    if (checkRestart) {
      await this.checkAndRestartIfNeeded();
    }

    // Use PageFactory to create the page
    return await this.pageFactory.createPage({
      checkRestart: false, // Already handled above
      trackActive: true,
      addToDisposables: true,
      incrementOperationCount: true,
      logMemory: true,
    });
  }

  /**
   * Checks if browser should be restarted based on operation count or memory
   * Restarts automatically to prevent memory accumulation
   * Delegates to MemoryMonitor
   */
  async checkAndRestartIfNeeded() {
    await this.memoryMonitor.checkAndRestartIfNeeded(async () => {
      await this.restartBrowser();
    });
  }

  /**
   * Force browser restart (bypasses rate limiting and operation count checks)
   * Use this between major processing stages to prevent memory accumulation
   * Delegates to MemoryMonitor for rate limiting control
   */
  async forceRestartBrowser() {
    logger.info("[PERF] Force restarting browser between processing stages");
    // Temporarily disable rate limiting
    const originalMinInterval = this.memoryMonitor.disableRateLimiting();
    await this.restartBrowser();
    this.memoryMonitor.restoreRateLimiting(originalMinInterval);
  }

  /**
   * Restarts the browser to free memory
   * Closes all pages and the browser, then launches a new one
   * Will NOT restart if there are active pages in use
   * Delegates to BrowserLifecycleManager
   */
  async restartBrowser() {
    await this.browserLifecycleManager.restart(
      this.activePages,
      async () => {
        // Cleanup pages before restart
        const browser = this.browserLifecycleManager.getBrowser();
        if (browser) {
          const pages = await getPagesSafely(browser);
          if (pages.length > 0) {
            logger.info(
              `[PERF] Closing ${pages.length} pages before browser restart`
            );
            await closePagesSafely(pages);
            // Remove from active set, reuse pool, and parallel pool
            pages.forEach((page) => {
              this.activePages.delete(page);
            });
            this.reusePageManager.clearPool(pages);
            this.pagePoolManager.removePages(pages);
          }
        }
      },
      () => {
        // Reset counters after restart
        this.memoryMonitor.resetAfterRestart();
        this.disposables = [];
      }
    );
  }

  /**
   * Create a pool of pages for parallel processing
   * Delegates to PagePoolManager
   * @param {number} size - Number of pages to create in pool (defaults to PARALLEL_CONFIG.PAGE_POOL_SIZE)
   * @returns {Promise<Page[]>} Array of ready-to-use pages
   */
  async createPagePool(size = null) {
    return await this.pagePoolManager.createPool(size);
  }

  /**
   * Create a single page for the pool
   * Delegates to PagePoolManager
   * @private
   * @returns {Promise<Page|null>} Created page or null if creation failed
   */
  async _createPoolPage() {
    return await this.pagePoolManager._createPoolPage();
  }

  /**
   * Get next available page from pool for parallel processing
   * Delegates to PagePoolManager
   * @returns {Promise<Page>} A page from the pool
   */
  async getPageFromPool() {
    return await this.pagePoolManager.getPage();
  }

  /**
   * Handle proxy-related errors and detect rate limits
   * Delegates to ProxyErrorHandler
   * @param {Error} error - The error that occurred
   * @param {Page} page - Optional page instance (for removing from pool if needed)
   * @param {Object} context - Optional operation context for better error messages
   */
  _handleProxyError(error, page = null, context = null) {
    this.proxyErrorHandler.handleError(error, page, context);
  }

  /**
   * Reset rate limit state after successful operations
   * Delegates to ProxyErrorHandler
   */
  _resetRateLimitState() {
    this.proxyErrorHandler.resetRateLimitState();
  }

  /**
   * Release a page back to the pool after parallel processing
   * Delegates to PagePoolManager
   * @param {Page} page - The page to release
   */
  async releasePageFromPool(page) {
    return await this.pagePoolManager.releasePage(page);
  }

  /**
   * Get a reusable page from pool, or create a new one if none available
   * Delegates to ReusePageManager
   * @returns {Promise<Page>} A page ready for use
   */
  async getReusablePage() {
    return await this.reusePageManager.getReusablePage();
  }

  /**
   * Release a page back to the reuse pool instead of closing it
   * Delegates to ReusePageManager
   * @param {Page} page - The page to release for reuse
   */
  async releasePageToPool(page) {
    return await this.reusePageManager.releasePageToPool(page);
  }

  /**
   * Closes a specific page and frees its memory
   * Call this after you're done with a page to prevent memory leaks
   * For page reuse, use releasePageToPool() instead
   */
  async closePage(page) {
    // Remove from reuse pool if it was there
    this.reusePageManager.removeFromPool(page);

    const closed = await require("./pageUtils").closePageSafely(page);
    this.activePages.delete(page);
    if (closed) {
      logger.debug("Page closed and memory freed");
    }
  }

  /**
   * Cleanup orphaned pages that might be accumulating
   * CRITICAL: Does NOT close pool pages or active pages - only truly orphaned ones
   * Call this periodically during long-running operations
   */
  async cleanupOrphanedPages() {
    if (!this.browserLifecycleManager.exists()) return;

    const browser = this.browserLifecycleManager.getBrowser();
    const allPages = await getPagesSafely(browser);

    // Get pages that are in pools or currently active (these should NOT be closed)
    const poolPages = new Set(this.pagePoolManager.getPagePool());
    const reusePages = this.reusePageManager.getReusablePages();
    const protectedPages = new Set([
      ...poolPages,
      ...reusePages,
      ...this.activePages,
    ]);

    // Find truly orphaned pages (not in pools, not active, not the default first page)
    const orphanedPages = allPages.filter((page, index) => {
      // Keep the first page (default browser page)
      if (index === 0) return false;
      // Don't close if it's in a pool or active
      if (protectedPages.has(page)) return false;
      // Don't close if it's already closed
      if (page.isClosed()) return false;
      // This is an orphaned page
      return true;
    });

    if (orphanedPages.length > 0) {
      const closedCount = await closePagesSafely(orphanedPages);
      if (closedCount > 0) {
        logger.info(
          `Cleaned up ${closedCount} orphaned pages (protected ${protectedPages.size} pool/active pages)`
        );
      }
    }
  }

  /**
   * Close browser and all pages
   * Delegates to BrowserLifecycleManager
   * @returns {Promise<void>}
   */
  async closeBrowser() {
    await this.browserLifecycleManager.close((pages) => {
      // Cleanup page references
      pages.forEach((page) => {
        this.activePages.delete(page);
      });
      this.reusePageManager.clearPool(pages);
      this.pagePoolManager.removePages(pages);
    });
  }

  /**
   * Get current memory usage statistics
   * Delegates to MemoryMonitor
   */
  getMemoryStats() {
    return this.memoryMonitor.getMemoryStats();
  }

  /**
   * Get pool utilization metrics
   * Provides visibility into pool performance and utilization
   * @returns {Object} Pool metrics including allocations, wait times, and utilization
   */
  /**
   * Get pool utilization metrics
   * Delegates to PagePoolManager
   * @returns {Object} Pool metrics including allocations, wait times, and utilization
   */
  getPoolMetrics() {
    return this.pagePoolManager.getMetrics();
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
    if (this.browserLifecycleManager.exists()) {
      const browser = this.browserLifecycleManager.getBrowser();
      const pages = await getPagesSafely(browser);
      await closePagesSafely(pages);
      // Clear reuse pool and parallel pool
      pages.forEach((page) => {
        this.activePages.delete(page);
      });
      this.reusePageManager.clearPool(pages);
      this.pagePoolManager.clearPool();
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
