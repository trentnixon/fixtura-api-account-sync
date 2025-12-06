/**
 * PageFactory - Centralized page creation logic
 * Extracted from PuppeteerManager for better separation of concerns
 * Handles common page creation, authentication, and setup
 */

const logger = require("../../../src/utils/logger");
const { setupPage } = require("../pageSetup");
const { getMemoryStats } = require("../memoryUtils");

class PageFactory {
  constructor(
    browserLifecycleManager,
    proxyConfigManager,
    memoryMonitor,
    activePages,
    disposables
  ) {
    this.browserLifecycleManager = browserLifecycleManager;
    this.proxyConfigManager = proxyConfigManager;
    this.memoryMonitor = memoryMonitor;
    this.activePages = activePages; // Reference to active pages set
    this.disposables = disposables; // Reference to disposables array
  }

  /**
   * Create a new page with full setup
   * Handles browser launch, rate limit backoff, authentication, and configuration
   * @param {Object} options - Creation options
   * @param {boolean} options.checkRestart - Whether to check for restart if no active pages (default: true)
   * @param {boolean} options.trackActive - Whether to track page as active (default: true)
   * @param {boolean} options.addToDisposables - Whether to add to disposables (default: true)
   * @param {boolean} options.incrementOperationCount - Whether to increment operation count (default: true)
   * @param {boolean} options.logMemory - Whether to log memory if interval reached (default: true)
   * @param {Function} options.onCloseCallback - Optional callback when page closes
   * @returns {Promise<Page>} Created and configured page
   */
  async createPage(options = {}) {
    const {
      checkRestart = false, // Default false - restart checks handled at PuppeteerManager level
      trackActive = true,
      addToDisposables = true,
      incrementOperationCount = true,
      logMemory = true,
      onCloseCallback = null,
    } = options;

    // Launch browser if needed
    await this.browserLifecycleManager.launch();

    // Note: Rate limit backoff and restart checks are handled at PuppeteerManager level

    // Get browser instance
    const browser = this.browserLifecycleManager.getBrowser();

    // CRITICAL: Create page and navigate immediately to prevent "Requesting main frame too early!" errors
    // The stealth plugin hooks run synchronously when newPage() is called, but main frame doesn't exist yet
    // By navigating immediately after creation, we ensure the main frame exists before stealth plugin accesses it
    const page = await browser.newPage();

    // Small delay to let stealth plugin hooks initialize (they run synchronously but need a tick)
    // This prevents "Requesting main frame too early!" errors
    await new Promise((resolve) => setTimeout(resolve, 10));

    // CRITICAL: Navigate to about:blank immediately to ensure main frame exists
    // This prevents "Requesting main frame too early!" errors from stealth plugin
    // when pages are created in parallel
    try {
      await page.goto("about:blank", {
        waitUntil: "domcontentloaded",
        timeout: 3000, // Reduced from 5000ms for faster failure detection
      });
    } catch (error) {
      // If navigation fails, log but continue - page might still be usable
      logger.debug(
        "[PageFactory] Failed to navigate to about:blank (non-fatal)",
        {
          error: error.message,
        }
      );
    }

    // Track this page as active
    if (trackActive) {
      this.activePages.add(page);
      page.once("close", () => {
        this.activePages.delete(page);
        if (onCloseCallback) {
          onCloseCallback(page);
        }
      });
    } else if (onCloseCallback) {
      // Even if not tracking as active, we still need the close callback (e.g., for pool cleanup)
      page.once("close", () => {
        onCloseCallback(page);
      });
    }

    // CRITICAL: Authenticate page BEFORE any other setup to prevent 407 errors
    // Authentication must happen before any navigation or requests
    await this.proxyConfigManager.authenticatePage(page);

    // Set up page with default configurations (authentication already done above)
    await setupPage(page, null); // Pass null to skip authentication in setupPage

    // Add to disposables if requested
    if (addToDisposables) {
      this.disposables.push(page);
    }

    // Increment operation count if requested
    if (incrementOperationCount) {
      this.memoryMonitor.incrementOperationCount();
    }

    // Log memory periodically if requested
    if (logMemory && this.memoryMonitor.shouldLogMemory()) {
      const stats = getMemoryStats();
      logger.info(
        `[PageFactory] Page created (op ${this.memoryMonitor.getOperationCount()}): RSS=${stats.rss.toFixed(
          2
        )}MB, Heap=${stats.heapUsed.toFixed(2)}MB`
      );
    }

    return page;
  }

  /**
   * Create a page for pool use (simplified version)
   * Used by PagePoolManager for creating pool pages
   * Pool pages should NOT be marked as active until allocated via getPage()
   * @param {Function} onCloseCallback - Callback when page closes (for pool cleanup)
   * @returns {Promise<Page|null>} Created page or null if creation failed
   */
  async createPoolPage(onCloseCallback = null) {
    try {
      return await this.createPage({
        checkRestart: false, // Pool pages don't trigger restart checks
        trackActive: false, // CRITICAL: Don't mark as active - will be marked when allocated via getPage()
        addToDisposables: true,
        incrementOperationCount: true,
        logMemory: false, // Pool creation logs separately
        onCloseCallback: onCloseCallback,
      });
    } catch (error) {
      logger.error("[PageFactory] Failed to create pool page", {
        error: error.message,
      });
      return null;
    }
  }
}

module.exports = PageFactory;
