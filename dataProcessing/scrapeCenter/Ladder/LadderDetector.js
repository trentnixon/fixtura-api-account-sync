const logger = require("../../../src/utils/logger");
const { getConfig, performanceMetrics } = require("./backoffConfig");

/**
 * LadderDetector class handles detecting whether a ladder exists and what type it is
 */
class LadderDetector {
  constructor(page) {
    this.page = page;

    // Get backoff configuration
    this.backoffConfig = getConfig();

    logger.info(
      `Using backoff strategy: ${
        process.env.SCRAPER_BACKOFF_STRATEGY || "balanced"
      }`
    );
    logger.info(
      `Initial delay: ${this.backoffConfig.initialDelay}ms, Max delay: ${this.backoffConfig.maxDelay}ms`
    );
  }

  /**
   * Checks if there's no ladder available for this grade
   * @returns {Promise<boolean>} true if no ladder available, false if ladder exists
   */
  async hasNoLadder() {
    try {
      // Try multiple selectors for the "no ladder" message
      const noLadderSelectors = [
        ".sc-cPiKLX", // Original selector
        '[class*="cPiKLX"]', // Partial class match
        'div:contains("no ladder")', // Text content
        'div:contains("ladder available")', // Alternative text
      ];

      // Check each selector
      for (const selector of noLadderSelectors) {
        try {
          const noLadderMessage = await this.page.$(selector);
          if (noLadderMessage) {
            const messageText = await noLadderMessage.evaluate(
              (el) => el.innerText
            );
            if (
              messageText.toLowerCase().includes("no ladder available") ||
              messageText.toLowerCase().includes("no ladder") ||
              messageText.toLowerCase().includes("ladder available")
            ) {
              logger.info(
                "No ladder available for this grade - this is normal for some competitions"
              );
              return true;
            }
          }
        } catch (selectorError) {
          // Continue to next selector
        }
      }

      // Also check page content for no ladder messages
      const pageText = await this.page.evaluate(() => document.body.innerText);
      if (
        pageText.toLowerCase().includes("no ladder available") ||
        pageText.toLowerCase().includes("no ladder")
      ) {
        logger.info(
          "No ladder available for this grade (found in page text) - this is normal for some competitions"
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.warn("Could not check for no ladder message:", error.message);
      return false;
    }
  }

  /**
   * Waits for the ladder table to appear using smart backoff strategy
   * @returns {Promise<boolean>} true if table found, false if timeout
   */
  async waitForLadderTable() {
    try {
      logger.info("Waiting for ladder table to load using smart backoff...");

      // First, wait for the page to be fully loaded
      logger.info("Waiting for page to fully load...");
      try {
        // Wait for the ladder container to exist first
        await this.page.waitForSelector('[data-testid="ladder"]', {
          timeout: 10000,
        });
        logger.info("✅ Ladder container found - page is loaded");
      } catch (containerError) {
        logger.warn(
          "Ladder container not found after 10 seconds:",
          containerError.message
        );
        return false;
      }

      let currentDelay = this.backoffConfig.initialDelay;
      let attempts = 0;

      while (attempts < this.backoffConfig.maxAttempts) {
        attempts++;

        // Quick initial check with minimal delay
        if (attempts === 1) {
          logger.info(
            `Attempt ${attempts}: Quick check (${this.backoffConfig.quickCheckDelay}ms)`
          );
          await this.page.waitForTimeout(this.backoffConfig.quickCheckDelay);
        } else {
          logger.info(`Attempt ${attempts}: Waiting ${currentDelay}ms`);
          await this.page.waitForTimeout(currentDelay);
        }

        // Check if table exists AND has team links
        const tableExists = await this.checkTableExists();
        if (tableExists) {
          logger.info(`✅ Ladder table found on attempt ${attempts}!`);

          // Record successful attempt for performance tracking
          performanceMetrics.recordAttempt(true, attempts);

          return true;
        }

        // Alternative check: Look directly for team links
        const teamLinks = await this.page.$$(
          '[data-testid="ladder"] table:first-of-type tbody tr td:nth-child(2) a'
        );
        if (teamLinks.length > 0) {
          logger.info(
            `✅ Team links found directly on attempt ${attempts}! (${teamLinks.length} teams)`
          );

          // Record successful attempt for performance tracking
          performanceMetrics.recordAttempt(true, attempts);

          return true;
        }

        // If this was the last attempt, break
        if (attempts >= this.backoffConfig.maxAttempts) {
          logger.warn(`❌ Table not found after ${attempts} attempts`);
          break;
        }

        // Calculate next delay with backoff
        currentDelay = Math.min(
          currentDelay * this.backoffConfig.backoffMultiplier,
          this.backoffConfig.maxDelay
        );

        logger.info(
          `Table not found, next attempt in ${Math.round(currentDelay)}ms`
        );
      }

      // Record failed attempt for performance tracking
      performanceMetrics.recordAttempt(false, attempts);

      logger.warn("Could not find ladder table after all attempts");

      // Final fallback: Try Puppeteer's built-in waitForSelector
      logger.info("Trying fallback method: waitForSelector...");
      try {
        await this.page.waitForSelector('[data-testid="ladder"] table', {
          timeout: 5000,
        });
        logger.info("✅ Fallback method succeeded - table found!");
        return true;
      } catch (fallbackError) {
        logger.warn("Fallback method also failed:", fallbackError.message);
        return false;
      }
    } catch (error) {
      logger.warn("Error during table detection:", error.message);
      return false;
    }
  }

  /**
   * Checks if a table exists on the page
   * @returns {Promise<boolean>} true if table found, false otherwise
   */
  async checkTableExists() {
    try {
      // First check if the ladder container exists
      const ladderContainer = await this.page.$('[data-testid="ladder"]');
      if (!ladderContainer) {
        logger.warn("Table detection: No ladder container found");
        return false;
      }

      // Check for tables specifically within the ladder container
      const tablesInLadder = await this.page.$$('[data-testid="ladder"] table');
      logger.info(
        `Table detection: Found ${tablesInLadder.length} tables in ladder container`
      );

      if (tablesInLadder.length > 0) {
        // Check if any table has team links - this is the key validation
        const teamLinksInTables = await this.page.$$(
          '[data-testid="ladder"] table tbody tr td a[href*="/teams/"]'
        );
        logger.info(
          `Table detection: Found ${teamLinksInTables.length} team links in tables`
        );

        // A valid table exists if we have tables AND team links
        const hasValidTable = teamLinksInTables.length > 0;
        logger.info(`Table detection: Valid table found: ${hasValidTable}`);

        return hasValidTable;
      }

      logger.warn("Table detection: No tables found in ladder container");
      return false;
    } catch (error) {
      logger.warn(`Error checking for table: ${error.message}`);
      logger.warn(`Error stack: ${error.stack}`);
      return false;
    }
  }

  /**
   * Gets basic page information for debugging
   * @returns {Promise<Object>} Page info object
   */
  async getPageInfo() {
    try {
      const pageInfo = {
        title: await this.page.title(),
        url: this.page.url(),
        hasTables: false,
        tableCount: 0,
        hasLadderElements: false,
        ladderElementCount: 0,
      };

      // Check for tables
      try {
        const tables = await this.page.$$("table");
        pageInfo.hasTables = tables.length > 0;
        pageInfo.tableCount = tables.length;
      } catch (error) {
        logger.warn("Could not check for tables:", error.message);
      }

      // Check for ladder elements
      try {
        const ladderElements = await this.page.$$(
          '[data-testid*="ladder"], [class*="ladder"], [id*="ladder"]'
        );
        pageInfo.hasLadderElements = ladderElements.length > 0;
        pageInfo.ladderElementCount = ladderElements.length;
      } catch (error) {
        logger.warn("Could not check for ladder elements:", error.message);
      }

      return pageInfo;
    } catch (error) {
      logger.warn("Could not get page info:", error.message);
      return {};
    }
  }

  /**
   * Gets performance statistics for the backoff strategy
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return performanceMetrics.getStats();
  }

  /**
   * Logs performance statistics
   */
  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    logger.info("📊 Backoff Strategy Performance Statistics:");
    logger.info(`  Pages Processed: ${stats.pagesProcessed}`);
    logger.info(`  Total Attempts: ${stats.totalAttempts}`);
    logger.info(
      `  Average Attempts per Page: ${stats.averageAttemptsPerPage.toFixed(2)}`
    );
    logger.info(`  Success Rate: ${stats.successRate.toFixed(1)}%`);

    if (stats.pagesProcessed > 0) {
      const avgTimePerPage = this.calculateAverageTimePerPage(
        stats.averageAttemptsPerPage
      );
      logger.info(
        `  Estimated Average Time per Page: ${avgTimePerPage.toFixed(1)}ms`
      );
    }
  }

  /**
   * Calculates estimated average time per page based on attempts
   * @param {number} avgAttempts - Average attempts per page
   * @returns {number} Estimated time in milliseconds
   */
  calculateAverageTimePerPage(avgAttempts) {
    if (avgAttempts <= 1) {
      return this.backoffConfig.quickCheckDelay;
    }

    let totalTime = this.backoffConfig.quickCheckDelay; // First attempt
    let currentDelay = this.backoffConfig.initialDelay;

    for (let i = 2; i <= avgAttempts; i++) {
      totalTime += currentDelay;
      currentDelay = Math.min(
        currentDelay * this.backoffConfig.backoffMultiplier,
        this.backoffConfig.maxDelay
      );
    }

    return totalTime;
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    performanceMetrics.reset();
    logger.info("Performance metrics reset");
  }
}

module.exports = LadderDetector;
