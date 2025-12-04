const logger = require("../../src/utils/logger");
const GameCRUD = require("../assignCenter/games/GameCrud");
const FixtureValidationService = require("../services/fixtureValidationService");
const ProcessingTracker = require("../services/processingTracker");

// Import validation components
const MemoryTracker = require("./components/validation/memoryTracker");
const ResultAggregator = require("./components/validation/resultAggregator");
const FixtureProcessor = require("./components/validation/fixtureProcessor");
const ValidationHelpers = require("./components/validation/validationHelpers");

/**
 * FixtureValidationProcessor handles validation of existing database fixtures.
 * Fetches existing fixtures and validates their URLs to identify invalid (404) fixtures.
 */
class FixtureValidationProcessor {
  constructor(dataObj, options = {}) {
    this.dataObj = dataObj;
    this.gameCRUD = new GameCRUD(dataObj);
    // PlayHQ blocks HTTP requests (403), so we MUST use Puppeteer for all validations
    // MEMORY OPTIMIZATION: Process in smaller batches, browser closed between batches
    this.validationService = new FixtureValidationService({
      usePuppeteer: options.usePuppeteer !== false, // Default to true (required for PlayHQ)
      timeout: options.timeout || 5000, // Reduced to 15 seconds for faster validation and less memory
      skipHttpValidation:
        options.skipHttpValidation !== undefined
          ? options.skipHttpValidation
          : true, // Default: true (skip HTTP for PlayHQ, we know it blocks HTTP)
    });
    this.processingTracker = ProcessingTracker.getInstance();
    // Batch size for processing (browser cleanup between batches)
    // MEMORY OPTIMIZATION: 5 fixtures per batch for Heroku memory constraints (reduced from 20)
    // Smaller batches = more frequent browser cleanup = lower memory usage
    this.concurrencyLimit =
      options.concurrencyLimit || (options.usePuppeteer !== false ? 5 : 5); // 5 fixtures per batch (memory optimized for Heroku)
    this.validationResults = [];
    // MEMORY OPTIMIZATION: Clear validation results after use to free memory
  }

  /**
   * Main processing method for fixture validation.
   * Fetches fixtures and validates their URLs to identify invalid (404) fixtures.
   */
  async process() {
    try {
      // Initialize memory tracking
      const initialMemory = MemoryTracker.logInitialMemory(this.dataObj);

      // Get team IDs
      const teamIds = ValidationHelpers.getTeamIds(this.dataObj);
      if (!teamIds || teamIds.length === 0) {
        logger.warn("No team IDs found for fixture fetch");
        this.processingTracker.itemFound("fixture-validation", 0);
        return ValidationHelpers.createEmptyResult();
      }

      // Initialize components
      const fixtureProcessor = new FixtureProcessor(
        this.gameCRUD,
        this.validationService,
        this.concurrencyLimit
      );
      const resultAggregator = new ResultAggregator();

      // MEMORY FIX: Use new validation endpoint with incremental processing
      logger.info(
        `[VALIDATION] Using new validation endpoint with incremental processing for ${teamIds.length} teams`
      );

      // Calculate date range
      const { fromDate, toDate } = fixtureProcessor.calculateDateRange();

      // MEMORY CRITICAL FIX: Use very small page size to prevent immediate memory spikes
      const pageSize = 25; // CRITICAL: Small page size to prevent memory spikes
      let page = 1;
      let hasMore = true;
      let totalFixtures = 0;

      // Process fixtures page by page
      while (hasMore) {
        // Fetch page
        const {
          pageFixtures,
          pagination,
          hasMore: pageHasMore,
        } = await fixtureProcessor.fetchPage(
          teamIds,
          fromDate,
          toDate,
          page,
          pageSize
        );

        if (!pageFixtures || pageFixtures.length === 0) {
          hasMore = false;
          break;
        }

        // Update total count from first page
        if (page === 1) {
          totalFixtures = pagination.total || pageFixtures.length;
          this.processingTracker.itemFound("fixture-validation", totalFixtures);
          logger.info(
            `[VALIDATION] Found ${totalFixtures} total fixtures to validate across ${
              pagination.pageCount || 1
            } pages`
          );
        }

        logger.info(
          `[VALIDATION] Page ${page}/${pagination.pageCount || 1}: ${
            pageFixtures.length
          } fixtures (${totalFixtures} total)`
        );

        // Validate page
        const pageValidationResults = await fixtureProcessor.validatePage(
          pageFixtures,
          page
        );

        // Aggregate results (only stores invalid fixtures)
        resultAggregator.processPageResults(
          pageValidationResults,
          pageFixtures
        );

        // Clear page data to free memory
        fixtureProcessor.clearPageData(pageFixtures, pageValidationResults);

        // Hint GC if needed
        const stats = resultAggregator.getStats();
        fixtureProcessor.hintGarbageCollection(page, {
          ...stats,
          totalFixtures,
        });

        // Check if more pages
        hasMore = pageHasMore;
        page++;

        // Log page memory
        MemoryTracker.logPageMemory(page - 1, initialMemory, {
          ...stats,
          totalFixtures,
        });
      }

      // Get aggregated results
      const { invalidResults, totalValidCount, totalInvalidCount } =
        resultAggregator.getResults();

      // Store results
      this.validationResults = invalidResults;
      const validCount = totalValidCount;
      const invalidCount = totalInvalidCount;

      // Track validation results
      this.processingTracker.itemUpdated("fixture-validation", validCount);
      this.processingTracker.itemDeleted("fixture-validation", invalidCount);

      // Log validation summary
      ValidationHelpers.logValidationSummary(invalidResults, totalFixtures);

      // Get fixtures array for comparison
      const fixturesArray = resultAggregator.getFixturesArray();

      // Log final memory
      const finalStats = resultAggregator.getStats();
      MemoryTracker.logFinalMemory(initialMemory, {
        ...finalStats,
        totalFixtures,
        validCount,
        invalidCount,
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        teamIdsCount: teamIds.length,
        pagesProcessed: page - 1,
        fixturesArrayLength: fixturesArray.length,
      });

      // Log return summary
      ValidationHelpers.logReturnSummary(
        this.dataObj,
        invalidResults.length,
        fixturesArray.length
      );

      // Return validation results - only invalid ones stored
      return {
        validated: totalValidCount + totalInvalidCount,
        valid: validCount,
        invalid: invalidCount,
        results: invalidResults, // Only invalid results (needed for cleanup)
        fixtures: fixturesArray, // Only fixture IDs (minimal data for comparison)
      };
    } catch (error) {
      this.processingTracker.errorDetected("fixture-validation");
      logger.error(
        "[VALIDATION] Error in FixtureValidationProcessor process method",
        {
          error: error.message,
          stack: error.stack,
          method: "process",
          class: "FixtureValidationProcessor",
          accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        }
      );
      throw error;
    }
  }

  /**
   * Gets team IDs from dataObj
   * @returns {Array<number>} Array of team database IDs
   */
  getTeamIds() {
    return ValidationHelpers.getTeamIds(this.dataObj);
  }

  /**
   * Gets validation results
   * @returns {Array<Object>} Validation results
   */
  getValidationResults() {
    return this.validationResults;
  }

  /**
   * Gets invalid fixtures (fixtures with 404 or other errors)
   * @returns {Array<Object>} Invalid fixtures
   */
  getInvalidFixtures() {
    return this.validationResults.filter((result) => !result.valid);
  }
}

module.exports = FixtureValidationProcessor;
