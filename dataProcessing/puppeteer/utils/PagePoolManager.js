/**
 * PagePoolManager - Handles page pool management for parallel processing
 * Extracted from PuppeteerManager for better separation of concerns
 */

const logger = require("../../../src/utils/logger");
const { getMemoryStats } = require("../memoryUtils");

class PagePoolManager {
  constructor(
    browserLifecycleManager,
    proxyConfigManager,
    memoryMonitor,
    activePages,
    disposables,
    maxPagePoolSize,
    pageFactory = null
  ) {
    this.browserLifecycleManager = browserLifecycleManager;
    this.proxyConfigManager = proxyConfigManager;
    this.memoryMonitor = memoryMonitor;
    this.activePages = activePages; // Reference to active pages set
    this.disposables = disposables; // Reference to disposables array
    this.maxPagePoolSize = maxPagePoolSize;
    // Use provided PageFactory or create one
    if (pageFactory) {
      this.pageFactory = pageFactory;
    } else {
      const PageFactory = require("./PageFactory");
      this.pageFactory = new PageFactory(
        browserLifecycleManager,
        proxyConfigManager,
        memoryMonitor,
        activePages,
        disposables
      );
    }
    this.pagePool = []; // Array of pages for parallel processing
    this.pagePoolIndex = 0; // Current index for round-robin page allocation
    // Pool utilization metrics
    this.poolMetrics = {
      totalAllocations: 0,
      totalReleases: 0,
      maxWaitTime: 0,
      averageWaitTime: 0,
      waitTimes: [],
      poolUtilization: [],
    };
  }

  /**
   * Create a pool of pages for parallel processing
   * Part of Strategy 1: Parallel Page Processing
   * Creates multiple pages upfront with proxy authentication to enable concurrent processing
   * @param {number} size - Number of pages to create in pool (defaults to maxPagePoolSize)
   * @returns {Promise<Page[]>} Array of ready-to-use pages
   */
  async createPool(size = null) {
    logger.info(
      `[PagePoolManager] Called with size=${size}, maxPagePoolSize=${this.maxPagePoolSize}, current pool length=${this.pagePool.length}`
    );

    await this.browserLifecycleManager.launch();

    logger.info(
      `[PagePoolManager] Browser launched, proceeding with pool creation`
    );

    const poolSize = size || this.maxPagePoolSize;

    // If pool already exists and has pages, don't create new ones - just ensure we have enough
    if (this.pagePool.length > 0) {
      const availablePages = this.pagePool.filter(
        (page) => !page.isClosed() && !this.activePages.has(page)
      );
      const neededPages = poolSize - this.pagePool.length;

      if (neededPages <= 0) {
        logger.debug(
          `Page pool already exists with ${this.pagePool.length} pages (need ${poolSize}), skipping creation`
        );
        return this.pagePool.filter((page) => !page.isClosed());
      }

      logger.info(
        `Page pool exists but needs ${neededPages} more pages (current: ${this.pagePool.length}, target: ${poolSize})`
      );
      // Continue to create only the needed pages
    } else {
      logger.info(
        `Creating page pool of ${poolSize} pages for parallel processing`
      );
    }

    const pages = [];
    const errors = [];

    // Create pages sequentially to avoid "Requesting main frame too early!" errors
    // from stealth plugin when creating pages in parallel
    const results = [];
    for (let i = 0; i < poolSize; i++) {
      try {
        const page = await this._createPoolPage();
        results.push(page);
        // Small delay between page creations to allow stealth plugin to initialize
        if (i < poolSize - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } catch (error) {
        logger.error(`Failed to create page ${i + 1} in pool`, {
          error: error.message,
        });
        errors.push({ index: i, error: error.message });
        results.push(null);
      }
    }
    const successfulPages = results.filter((page) => page !== null);

    // Add successful pages to pool (only if they're not already in the pool)
    for (const page of successfulPages) {
      if (!this.pagePool.includes(page)) {
        this.pagePool.push(page);
      } else {
        logger.debug("Page already in pool, skipping duplicate");
      }
    }

    if (errors.length > 0) {
      logger.warn(
        `Created ${successfulPages.length}/${poolSize} pages in pool. ${errors.length} failed.`,
        { errors }
      );
    } else {
      logger.info(
        `Successfully created page pool with ${successfulPages.length} pages`
      );
    }

    // Log memory after pool creation
    const stats = getMemoryStats();
    logger.info(
      `[PERF] Page pool created: ${
        successfulPages.length
      } pages, RSS=${stats.rss.toFixed(2)}MB, Heap=${stats.heapUsed.toFixed(
        2
      )}MB`
    );

    return successfulPages;
  }

  /**
   * Create a single page for the pool
   * Delegates to PageFactory for consistent page creation
   * @returns {Promise<Page|null>} Created page or null if creation failed
   */
  async _createPoolPage() {
    return await this.pageFactory.createPoolPage((page) => {
      // Remove from pool if closed
      const index = this.pagePool.indexOf(page);
      if (index > -1) {
        this.pagePool.splice(index, 1);
      }
    });
  }

  /**
   * Get next available page from pool for parallel processing
   * Part of Strategy 1: Parallel Page Processing
   * Uses round-robin allocation to distribute load across pages
   * @returns {Promise<Page>} A page from the pool
   */
  async getPage() {
    const waitStart = Date.now();
    await this.browserLifecycleManager.launch();

    // Filter out closed pages from pool first
    this.pagePool = this.pagePool.filter((page) => !page.isClosed());

    // NEW: Maintain minimum pool size automatically
    // This prevents pool from shrinking below target size when pages crash
    const minPoolSize = this.maxPagePoolSize;
    if (this.pagePool.length < minPoolSize) {
      const needed = minPoolSize - this.pagePool.length;
      logger.info(
        `[PagePoolManager] Pool below minimum (${this.pagePool.length}/${minPoolSize}), creating ${needed} replacement page(s)`
      );

      // Create replacement pages in parallel
      const newPages = await Promise.all(
        Array(needed)
          .fill(null)
          .map(() => this._createPoolPage())
      );

      // Add successful pages to pool
      const successfulPages = newPages.filter((p) => p !== null);
      for (const page of successfulPages) {
        if (!this.pagePool.includes(page)) {
          this.pagePool.push(page);
        }
      }

      if (successfulPages.length > 0) {
        logger.info(
          `[PagePoolManager] Created ${successfulPages.length}/${needed} replacement page(s), pool size now: ${this.pagePool.length}`
        );
      }
    }

    // If pool is still empty after replenishment, create new pool
    if (this.pagePool.length === 0) {
      logger.warn(
        "Page pool is empty after replenishment attempt, creating new pool"
      );
      await this.createPool();
    }

    // Try to find an available (non-active) page in the pool
    // If none available, WAIT until one becomes free
    // This handles cases where concurrency > pool size
    const maxRetries = 300; // 30 seconds (at 100ms interval)
    let retries = 0;

    while (retries < maxRetries) {
      // Find first available page
      const page = this.pagePool.find(
        (p) => !this.activePages.has(p) && !p.isClosed()
      );

      if (page) {
        // Mark as active BEFORE returning
        this.activePages.add(page);

        // Record metrics
        const waitTime = Date.now() - waitStart;
        this.poolMetrics.totalAllocations++;
        this.poolMetrics.waitTimes.push(waitTime);
        this.poolMetrics.maxWaitTime = Math.max(
          this.poolMetrics.maxWaitTime,
          waitTime
        );

        // Keep only last 100 wait times
        if (this.poolMetrics.waitTimes.length > 100) {
          this.poolMetrics.waitTimes.shift();
        }

        // Calculate average wait time
        const sum = this.poolMetrics.waitTimes.reduce((a, b) => a + b, 0);
        this.poolMetrics.averageWaitTime =
          sum / this.poolMetrics.waitTimes.length;

        // Record pool utilization snapshot (active/total)
        const utilization =
          this.pagePool.length > 0
            ? (this.activePages.size / this.pagePool.length) * 100
            : 0;

        this.poolMetrics.poolUtilization.push({
          timestamp: Date.now(),
          active: this.activePages.size,
          total: this.pagePool.length,
          utilization: utilization,
        });

        // Keep only last 100 utilization snapshots
        if (this.poolMetrics.poolUtilization.length > 100) {
          this.poolMetrics.poolUtilization.shift();
        }

        logger.debug(
          `[PagePoolManager] Allocated page (pool size: ${
            this.pagePool.length
          }, active pages: ${
            this.activePages.size
          }, wait: ${waitTime}ms, utilization: ${utilization.toFixed(1)}%)`
        );
        return page;
      }

      // No page available, wait and retry
      if (retries === 0) {
        logger.info(
          `[PagePoolManager] No pages available (active: ${this.activePages.size}/${this.pagePool.length}), waiting...`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // If we get here, we timed out waiting for a page
    logger.error(
      `[PagePoolManager] Timed out waiting for available page after ${
        maxRetries * 100
      }ms`
    );
    throw new Error("Timed out waiting for available page from pool");
  }

  /**
   * Release a page back to the pool after parallel processing
   * Part of Strategy 1: Parallel Page Processing
   * Marks page as available for next allocation
   * @param {Page} page - The page to release
   */
  async releasePage(page) {
    if (!page || page.isClosed()) {
      // If page is closed, remove it from pool if it's still there
      const index = this.pagePool.indexOf(page);
      if (index > -1) {
        this.pagePool.splice(index, 1);
      }
      this.activePages.delete(page);
      return;
    }

    // Remove from active pages (makes it available for next allocation)
    this.activePages.delete(page);

    // Record metrics
    this.poolMetrics.totalReleases++;

    // Log warning if utilization is consistently high (>80%)
    if (this.poolMetrics.poolUtilization.length >= 10) {
      const recentUtilization = this.poolMetrics.poolUtilization
        .slice(-10)
        .map((u) => u.utilization);
      const avgUtilization =
        recentUtilization.reduce((a, b) => a + b, 0) / recentUtilization.length;

      if (
        avgUtilization > 80 &&
        this.pagePool.length < this.maxPagePoolSize * 2
      ) {
        logger.warn(
          `[PagePoolManager] High pool utilization detected (${avgUtilization.toFixed(
            1
          )}%), consider increasing pool size`,
          {
            averageUtilization: avgUtilization.toFixed(1),
            currentPoolSize: this.pagePool.length,
            maxPoolSize: this.maxPagePoolSize,
            activePages: this.activePages.size,
            recommendation: `Consider increasing PAGE_POOL_SIZE from ${
              this.maxPagePoolSize
            } to ${Math.ceil(this.maxPagePoolSize * 1.5)}`,
          }
        );
      }
    }

    // DON'T navigate to about:blank here - we'll do it in getPage() before reuse
    // This avoids the "close and reopen" appearance
    // The page stays in the pool with its current state, and will be reset when allocated next
    logger.debug(
      "Page released from parallel pool (will be reset on next allocation)"
    );
  }

  /**
   * Get pool utilization metrics
   * Provides visibility into pool performance and utilization
   * @returns {Object} Pool metrics including allocations, wait times, and utilization
   */
  getMetrics() {
    const currentUtilization =
      this.pagePool.length > 0
        ? (this.activePages.size / this.pagePool.length) * 100
        : 0;

    // Calculate recent average utilization (last 10 snapshots)
    let recentAvgUtilization = 0;
    if (this.poolMetrics.poolUtilization.length > 0) {
      const recent = this.poolMetrics.poolUtilization
        .slice(-10)
        .map((u) => u.utilization);
      recentAvgUtilization = recent.reduce((a, b) => a + b, 0) / recent.length;
    }

    return {
      ...this.poolMetrics,
      currentUtilization: currentUtilization,
      recentAverageUtilization: recentAvgUtilization,
      poolSize: this.pagePool.length,
      activePages: this.activePages.size,
      availablePages: this.pagePool.length - this.activePages.size,
      maxPoolSize: this.maxPagePoolSize,
      utilizationHistory: this.poolMetrics.poolUtilization.slice(-20), // Last 20 snapshots
    };
  }

  /**
   * Get page pool array (for external access if needed)
   * @returns {Array<Page>} Page pool array
   */
  getPagePool() {
    return this.pagePool;
  }

  /**
   * Clear page pool (used during cleanup/restart)
   */
  clearPool() {
    this.pagePool = [];
    this.pagePoolIndex = 0;
  }

  /**
   * Remove pages from pool (used during cleanup)
   * @param {Array<Page>} pages - Pages to remove from pool
   */
  removePages(pages) {
    pages.forEach((page) => {
      const index = this.pagePool.indexOf(page);
      if (index > -1) {
        this.pagePool.splice(index, 1);
      }
    });
    this.pagePoolIndex = 0;
  }
}

module.exports = PagePoolManager;
