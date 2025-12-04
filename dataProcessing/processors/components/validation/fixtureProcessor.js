const logger = require("../../../../src/utils/logger");

/**
 * Handles fetching and processing fixtures page by page
 */
class FixtureProcessor {
  constructor(gameCRUD, validationService, concurrencyLimit) {
    this.gameCRUD = gameCRUD;
    this.validationService = validationService;
    this.concurrencyLimit = concurrencyLimit;
  }

  /**
   * Calculate date range for fixture fetching
   * @returns {Object} Date range object with fromDate and toDate
   */
  calculateDateRange() {
    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + 7);
    toDate.setHours(23, 59, 59, 999);
    return { fromDate, toDate };
  }

  /**
   * Fetch a page of fixtures
   * @param {Array} teamIds - Team IDs to fetch fixtures for
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @returns {Promise<Object>} Page response with data and pagination
   */
  async fetchPage(teamIds, fromDate, toDate, page, pageSize) {
    logger.info(
      `[VALIDATION] Fetching page ${page} (${pageSize} fixtures per page)`
    );

    const pageResponse = await this.gameCRUD.getFixturesForValidation(
      teamIds,
      fromDate,
      toDate,
      page,
      pageSize
    );

    const pageFixtures = pageResponse.data || [];
    const pagination = pageResponse.meta?.pagination || {};

    if (!pageFixtures || pageFixtures.length === 0) {
      logger.info(
        `[VALIDATION] No fixtures found on page ${page}, stopping pagination`
      );
      return { pageFixtures: [], pagination: {}, hasMore: false };
    }

    return {
      pageFixtures,
      pagination,
      hasMore: page < (pagination.pageCount || 1),
    };
  }

  /**
   * Validate a page of fixtures
   * @param {Array} pageFixtures - Fixtures to validate
   * @param {number} page - Current page number
   * @returns {Promise<Array>} Validation results
   */
  async validatePage(pageFixtures, page) {
    logger.info(
      `[VALIDATION] Validating page ${page} fixtures using Puppeteer (concurrency: ${this.concurrencyLimit}, timeout: ${this.validationService.timeout}ms)`
    );

    const pageValidationResults =
      await this.validationService.validateFixturesBatch(
        pageFixtures,
        this.concurrencyLimit
      );

    return pageValidationResults;
  }

  /**
   * Clear page data to free memory
   * @param {Array} pageFixtures - Fixtures array to clear
   * @param {Array} pageValidationResults - Results array to clear
   */
  clearPageData(pageFixtures, pageValidationResults) {
    // MEMORY FIX: Clear page data immediately after processing
    // Arrays are scoped to loop iteration, but clearing helps GC
    pageFixtures.length = 0;
    pageValidationResults.length = 0;
  }

  /**
   * Hint garbage collection if needed
   * @param {number} page - Current page number
   * @param {Object} stats - Current statistics
   */
  hintGarbageCollection(page, stats) {
    // Force GC hint every 3 pages (more frequent for large associations)
    if (page > 0 && page % 3 === 0 && global.gc) {
      global.gc();
      logger.info(`[VALIDATION] GC hint after page ${page}`, {
        invalidCount: stats.invalidResultsLength,
        validCount: stats.totalValidCount,
        totalProcessed: stats.totalValidCount + stats.totalInvalidCount,
      });
    }
  }
}

module.exports = FixtureProcessor;
