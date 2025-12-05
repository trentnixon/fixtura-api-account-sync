/**
 * ReusePageManager - Handles reusable page management for single-item processing
 * Extracted from PuppeteerManager for better separation of concerns
 * Part of Strategy 2: Page Reuse & Connection Pooling
 */

const logger = require("../../../src/utils/logger");
const { closePageSafely } = require("../pageUtils");

class ReusePageManager {
  constructor(activePages, createPageCallback, closePageCallback) {
    this.activePages = activePages; // Reference to active pages set
    this.createPageCallback = createPageCallback; // Callback to create new page
    this.closePageCallback = closePageCallback; // Callback to close page
    this.reusablePages = new Set(); // Pages available for reuse
    this.maxReusablePages = 5; // Maximum pages to keep in reuse pool
  }

  /**
   * Get a reusable page from pool, or create a new one if none available
   * Part of Strategy 2: Page Reuse & Connection Pooling
   * Eliminates 3-4 second proxy authentication overhead by reusing pages
   * Note: Browser launch is handled by createPageCallback when creating new pages
   * @returns {Promise<Page>} A page ready for use
   */
  async getReusablePage() {
    logger.debug(
      `[ReusePageManager] Checking reuse pool: ${this.reusablePages.size} pages available, ${this.activePages.size} active`
    );

    // Try to find a reusable page that's not currently active
    for (const page of this.reusablePages) {
      if (!this.activePages.has(page) && !page.isClosed()) {
        // Mark as active BEFORE resetting state
        this.activePages.add(page);

        // PROXY OPTIMIZATION: Reset page state before reuse (skip if already blank)
        try {
          const currentUrl = page.url();
          // Only reset if page has a real URL (skip blank/data URLs to reduce proxy overhead)
          if (
            currentUrl !== "about:blank" &&
            currentUrl !== "chrome-error://chromewebdata/" &&
            !currentUrl.startsWith("data:")
          ) {
            await page.goto("about:blank", {
              waitUntil: "domcontentloaded",
              timeout: 3000, // PROXY OPTIMIZATION: Reduced from 5000ms - blank page loads quickly
            });
          }
        } catch (error) {
          // If navigation fails, page might be in bad state - remove from pool and create new
          logger.warn(
            "[ReusePageManager] Failed to reset reused page, creating new one",
            {
              error: error.message,
            }
          );
          this.reusablePages.delete(page);
          return await this.createPageCallback();
        }

        return page;
      }
    }

    // No reusable page available, create a new one
    logger.debug(
      `[ReusePageManager] No reusable page found, creating new page (reuse pool: ${this.reusablePages.size}/${this.maxReusablePages})`
    );
    const page = await this.createPageCallback();

    // Add to reuse pool if we haven't hit the limit
    if (this.reusablePages.size < this.maxReusablePages) {
      this.reusablePages.add(page);
      logger.info(
        `[ReusePageManager] Added page to reuse pool (${this.reusablePages.size}/${this.maxReusablePages}) - NOTE: This is for single-item processing, not parallel`
      );
    } else {
      logger.debug(
        `[ReusePageManager] Reuse pool at max capacity (${this.maxReusablePages}), not adding to pool`
      );
    }

    return page;
  }

  /**
   * Release a page back to the reuse pool instead of closing it
   * Part of Strategy 2: Page Reuse & Connection Pooling
   * Call this instead of closePage() when you want to reuse the page later
   * @param {Page} page - The page to release for reuse
   */
  async releasePageToPool(page) {
    if (!page || page.isClosed()) {
      return;
    }

    // Remove from active pages
    this.activePages.delete(page);

    // PROXY OPTIMIZATION: Navigate to blank page to clear state (cookies, localStorage, etc.)
    try {
      await page.goto("about:blank", {
        waitUntil: "domcontentloaded",
        timeout: 3000, // PROXY OPTIMIZATION: Reduced from 5000ms - blank page loads quickly even through proxy
      });
      logger.debug(
        "[ReusePageManager] Page released to reuse pool and state cleared"
      );
    } catch (error) {
      // If we can't clear state, close the page instead
      logger.warn(
        "[ReusePageManager] Failed to clear page state, closing instead of reusing",
        {
          error: error.message,
        }
      );
      this.reusablePages.delete(page);
      if (this.closePageCallback) {
        await this.closePageCallback(page);
      }
    }
  }

  /**
   * Remove a page from the reuse pool (used when closing pages)
   * @param {Page} page - The page to remove from reuse pool
   */
  removeFromPool(page) {
    this.reusablePages.delete(page);
  }

  /**
   * Clear all pages from reuse pool (used during cleanup)
   * @param {Array<Page>} pages - Optional array of pages to remove (if not provided, clears all)
   */
  clearPool(pages = null) {
    if (pages) {
      pages.forEach((page) => {
        this.reusablePages.delete(page);
      });
    } else {
      this.reusablePages.clear();
    }
  }

  /**
   * Get reuse pool size
   * @returns {number} Number of pages in reuse pool
   */
  getPoolSize() {
    return this.reusablePages.size;
  }

  /**
   * Get max reusable pages setting
   * @returns {number} Maximum pages allowed in reuse pool
   */
  getMaxPoolSize() {
    return this.maxReusablePages;
  }

  /**
   * Get all pages in the reuse pool (for cleanup protection)
   * @returns {Set<Page>} Set of pages in reuse pool
   */
  getReusablePages() {
    return new Set(this.reusablePages);
  }
}

module.exports = ReusePageManager;
