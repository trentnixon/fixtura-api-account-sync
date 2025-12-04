const logger = require("../../../../src/utils/logger");

/**
 * Memory tracking utilities for validation processing
 */
class MemoryTracker {
  /**
   * Get current memory statistics
   * @returns {Object} Memory stats in MB
   */
  static getMemoryStats() {
    try {
      const memoryUtils = require("../../../puppeteer/memoryUtils");
      return memoryUtils.getMemoryStats();
    } catch (memError) {
      logger.warn(
        "[VALIDATION] Could not get memory stats:",
        memError.message
      );
      return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
    }
  }

  /**
   * Log initial memory state
   * @param {Object} dataObj - Data object with account info
   * @returns {Object} Initial memory stats
   */
  static logInitialMemory(dataObj) {
    const initialMemory = this.getMemoryStats();
    logger.info("[VALIDATION] Starting fixture validation process", {
      accountId: dataObj.ACCOUNT.ACCOUNTID,
      accountType: dataObj.ACCOUNT.ACCOUNTTYPE,
      initialMemory: {
        rss: `${initialMemory.rss}MB`,
        heapUsed: `${initialMemory.heapUsed}MB`,
        heapTotal: `${initialMemory.heapTotal}MB`,
        external: `${initialMemory.external}MB`,
      },
    });
    return initialMemory;
  }

  /**
   * Log memory state after processing a page
   * @param {number} page - Current page number
   * @param {Object} initialMemory - Initial memory stats
   * @param {Object} stats - Processing statistics
   */
  static logPageMemory(page, initialMemory, stats) {
    const pageMemory = this.getMemoryStats();
    logger.info(
      `[VALIDATION] Page ${page} complete: Validated ${
        stats.totalValidCount + stats.totalInvalidCount
      }/${stats.totalFixtures} fixtures (${stats.totalValidCount} valid, ${stats.totalInvalidCount} invalid, ${
        stats.invalidResultsLength
      } invalid stored)`,
      {
        memory: {
          rss: `${pageMemory.rss}MB (+${
            pageMemory.rss - initialMemory.rss
          }MB)`,
          heapUsed: `${pageMemory.heapUsed}MB (+${
            pageMemory.heapUsed - initialMemory.heapUsed
          }MB)`,
        },
        objectSizes: {
          invalidResults: stats.invalidResultsLength,
          invalidFixtureIds: stats.invalidFixtureIdsSize,
          invalidFixtureData: stats.invalidFixtureDataSize,
        },
      }
    );
  }

  /**
   * Log final memory state
   * @param {Object} initialMemory - Initial memory stats
   * @param {Object} stats - Final processing statistics
   */
  static logFinalMemory(initialMemory, stats) {
    const finalMemory = this.getMemoryStats();
    logger.info("[VALIDATION] Fixture validation complete", {
      total: stats.totalFixtures,
      validated: stats.totalValidCount + stats.totalInvalidCount,
      valid: stats.validCount,
      invalid: stats.invalidCount,
      invalidStored: stats.invalidResultsLength,
      accountId: stats.accountId,
      teamIdsCount: stats.teamIdsCount,
      pagesProcessed: stats.pagesProcessed,
      memoryNote: "Only invalid results stored (not all results)",
      memory: {
        initial: {
          rss: `${initialMemory.rss}MB`,
          heapUsed: `${initialMemory.heapUsed}MB`,
        },
        final: {
          rss: `${finalMemory.rss}MB`,
          heapUsed: `${finalMemory.heapUsed}MB`,
        },
        delta: {
          rss: `+${finalMemory.rss - initialMemory.rss}MB`,
          heapUsed: `+${finalMemory.heapUsed - initialMemory.heapUsed}MB`,
        },
      },
      objectSizes: {
        invalidResults: stats.invalidResultsLength,
        invalidFixtureIds: stats.invalidFixtureIdsSize,
        invalidFixtureData: stats.invalidFixtureDataSize,
        fixturesArray: stats.fixturesArrayLength,
      },
    });
  }
}

module.exports = MemoryTracker;

