const logger = require("../../src/utils/logger");
const GameCRUD = require("../assignCenter/games/GameCrud");
const FixtureValidationService = require("../services/fixtureValidationService");
const ProcessingTracker = require("../services/processingTracker");

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
      logger.info("[VALIDATION] Starting fixture validation process", {
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
      });

      // Get team IDs
      const teamIds = this.getTeamIds();
      if (!teamIds || teamIds.length === 0) {
        logger.warn("No team IDs found for fixture fetch");
        this.processingTracker.itemFound("fixture-validation", 0);
        return {
          validated: 0,
          valid: 0,
          invalid: 0,
          results: [],
          fixtures: [],
        };
      }

      // MEMORY FIX: Use new validation endpoint with incremental processing
      // Process fixtures page by page: fetch → validate → clear → repeat
      // This prevents accumulating all fixtures in memory
      logger.info(
        `[VALIDATION] Using new validation endpoint with incremental processing for ${teamIds.length} teams`
      );

      // Calculate date range (today to today + 14 days)
      const fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 14);
      toDate.setHours(23, 59, 59, 999);

      // Process fixtures incrementally (page by page)
      const pageSize = 100; // Process 100 fixtures at a time
      let page = 1;
      let hasMore = true;
      let totalFixtures = 0;

      // MEMORY FIX: For large associations with HUNDREDS of teams and THOUSANDS of fixtures,
      // we cannot accumulate all results. Only store invalid fixtures for cleanup.
      const invalidResults = []; // Only invalid fixture results
      const invalidFixtureIds = new Set(); // Track invalid IDs for quick lookup
      let totalValidCount = 0;
      let totalInvalidCount = 0;

      // For comparison, we only need minimal fixture data ({ id, gameID })
      // Use Map to avoid duplicates and use minimal memory
      const allFixtureIds = new Map(); // Map<id, { id, gameID }>

      while (hasMore) {
        logger.info(
          `[VALIDATION] Fetching page ${page} (${pageSize} fixtures per page)`
        );

        // Fetch one page of fixtures using new validation endpoint
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

        // Validate this page of fixtures
        // PlayHQ blocks HTTP requests, so we use Puppeteer directly for all validations
        logger.info(
          `[VALIDATION] Validating page ${page} fixtures using Puppeteer (concurrency: ${this.concurrencyLimit}, timeout: ${this.validationService.timeout}ms)`
        );
        const pageValidationResults =
          await this.validationService.validateFixturesBatch(
            pageFixtures,
            this.concurrencyLimit
          );

        // MEMORY FIX: Only accumulate invalid results, count valid ones
        // For large associations, this prevents storing thousands of valid result objects
        for (const result of pageValidationResults) {
          if (result.valid) {
            totalValidCount++;
          } else {
            totalInvalidCount++;
            // Only store invalid results (needed for cleanup)
            if (!invalidFixtureIds.has(result.fixtureId)) {
              invalidFixtureIds.add(result.fixtureId);
              invalidResults.push({
                fixtureId: result.fixtureId,
                gameID: result.gameID,
                valid: false,
                status: result.status,
                httpStatus: result.httpStatus,
              });
            }
          }
        }

        // Store minimal fixture data for comparison ({ id, gameID } only)
        // Use Map to avoid duplicates by fixture ID
        for (const fixture of pageFixtures) {
          if (fixture.id && !allFixtureIds.has(fixture.id)) {
            allFixtureIds.set(fixture.id, {
              id: fixture.id,
              gameID: fixture.gameID || null,
            });
          }
        }

        // MEMORY FIX: Clear page data immediately after processing
        pageFixtures.length = 0; // Clear array
        pageValidationResults.length = 0; // Results already processed

        // Force GC hint every 3 pages (more frequent for large associations)
        if (page > 0 && page % 3 === 0 && global.gc) {
          global.gc();
          logger.info(`[VALIDATION] GC hint after page ${page}`, {
            invalidCount: invalidResults.length,
            validCount: totalValidCount,
            totalProcessed: totalValidCount + totalInvalidCount,
          });
        }

        // Check if more pages
        hasMore = page < (pagination.pageCount || 1);
        page++;

        logger.info(
          `[VALIDATION] Page ${page - 1} complete: Validated ${
            totalValidCount + totalInvalidCount
          }/${totalFixtures} fixtures (${totalValidCount} valid, ${totalInvalidCount} invalid, ${
            invalidResults.length
          } invalid stored)`
        );
      }

      // MEMORY FIX: Only store invalid results (not all results)
      // For large associations: 10,000 fixtures with 90% valid = only 1,000 invalid results stored
      // vs storing all 10,000 results = 80% memory savings
      this.validationResults = invalidResults;

      // Count valid/invalid (already counted during processing)
      const validCount = totalValidCount;
      const invalidCount = totalInvalidCount;

      // Track validation results
      this.processingTracker.itemUpdated("fixture-validation", validCount);
      this.processingTracker.itemDeleted("fixture-validation", invalidCount);

      // MEMORY OPTIMIZATION: Only log summary, not individual results (reduces memory usage)
      // Log validation results (only invalid ones stored)
      if (invalidResults.length > 0) {
        logger.info(
          `[VALIDATION] Found ${invalidResults.length} invalid fixtures (out of ${totalFixtures} total validated)`
        );
        // Only log first 10 invalid fixtures to reduce memory
        invalidResults.slice(0, 10).forEach((result, index) => {
          logger.info(
            `[VALIDATION] ❌ Invalid ${index + 1}/${
              invalidResults.length
            } - GameID: ${result.gameID || "N/A"}, Status: ${
              result.status
            }, HTTP: ${result.httpStatus || "N/A"}`
          );
        });
        if (invalidResults.length > 10) {
          logger.info(
            `[VALIDATION] ... and ${
              invalidResults.length - 10
            } more invalid fixtures (not logged to save memory)`
          );
        }
      }

      // Summary log
      logger.info("[VALIDATION] Fixture validation complete", {
        total: totalFixtures,
        validated: totalValidCount + totalInvalidCount,
        valid: validCount,
        invalid: invalidCount,
        invalidStored: invalidResults.length,
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        teamIdsCount: teamIds.length,
        pagesProcessed: page - 1,
        memoryNote: "Only invalid results stored (not all results)",
      });

      // MEMORY FIX: Convert Map to Array for fixtures (minimal data only)
      // Map uses less memory than array, but comparison service expects array
      const fixturesArray = Array.from(allFixtureIds.values());

      logger.info(
        "[VALIDATION] Returning validation results (invalid-only storage)",
        {
          accountId: this.dataObj.ACCOUNT.ACCOUNTID,
          resultsCount: invalidResults.length,
          fixturesCount: fixturesArray.length,
          note: "Only invalid results stored - major memory savings for large associations",
        }
      );

      // Return validation results - only invalid ones stored
      // For large associations: 10,000 fixtures with 90% valid = only 1,000 results stored
      // vs storing all 10,000 = 80-90% memory savings
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
    if (!this.dataObj.TEAMS || !Array.isArray(this.dataObj.TEAMS)) {
      return [];
    }

    return this.dataObj.TEAMS.map((team) => team.id).filter(Boolean);
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
