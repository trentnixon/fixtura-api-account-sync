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
      timeout: options.timeout || 15000, // Reduced to 15 seconds for faster validation and less memory
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

      // Get team IDs and fetch fixtures (from today onwards, up to 14 days in the future)
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

      // Fetch existing fixtures for teams (from today onwards, up to 14 days, with batching)
      logger.info(
        `Fetching existing fixtures (from today onwards, up to 14 days) for ${teamIds.length} teams (batched)`
      );
      const databaseFixtures = await this.gameCRUD.getFixturesForTeams(teamIds);

      if (!databaseFixtures || databaseFixtures.length === 0) {
        logger.info(
          "No existing fixtures found in database (from today onwards, up to 14 days)"
        );
        this.processingTracker.itemFound("fixture-validation", 0);
        return {
          validated: 0,
          valid: 0,
          invalid: 0,
          results: [],
          fixtures: [],
        };
      }

      logger.info(
        `Found ${databaseFixtures.length} existing fixtures (from today onwards, up to 14 days)`
      );
      this.processingTracker.itemFound(
        "fixture-validation",
        databaseFixtures.length
      );

      // MEMORY OPTIMIZATION: Reduced logging - only log summary, not individual fixtures
      // Logging full fixture objects consumes significant memory
      logger.info(
        `[VALIDATION] Found ${databaseFixtures.length} fixtures to validate (from today onwards, up to 14 days)`
      );

      // ========================================
      // STEP 2: VALIDATE FIXTURE URLs
      // ========================================
      logger.info("Starting URL validation for fixtures...");

      // Prepare fixtures for validation - ONLY store minimal data to reduce memory
      // MEMORY OPTIMIZATION: Don't store full fixture objects, only essential fields
      // Extract minimal data immediately to allow garbage collection of full objects
      const fixturesToValidate = databaseFixtures.map((fixture) => {
        const fixtureId = fixture.id;
        const attributes = fixture.attributes || fixture;
        return {
          id: fixtureId,
          gameID: attributes.gameID || fixture.gameID,
          urlToScoreCard: attributes.urlToScoreCard || fixture.urlToScoreCard,
          // REMOVED: attributes - saves significant memory (5-10KB per fixture)
        };
      });

      // Note: databaseFixtures will be garbage collected after this function returns
      // We've extracted all needed data into fixturesToValidate (minimal data only)

      // Validate fixtures in batches
      // PlayHQ blocks HTTP requests, so we use Puppeteer directly for all validations
      logger.info(
        `Validating ${fixturesToValidate.length} fixture URLs using Puppeteer (PlayHQ blocks HTTP requests, concurrency: ${this.concurrencyLimit}, timeout: ${this.validationService.timeout}ms)`
      );
      const validationResults =
        await this.validationService.validateFixturesBatch(
          fixturesToValidate,
          this.concurrencyLimit
        );

      // Store validation results
      this.validationResults = validationResults;

      // Count valid/invalid
      const validCount = validationResults.filter((r) => r.valid).length;
      const invalidCount = validationResults.filter((r) => !r.valid).length;

      // Track validation results
      this.processingTracker.itemUpdated("fixture-validation", validCount);
      this.processingTracker.itemDeleted("fixture-validation", invalidCount);

      // MEMORY OPTIMIZATION: Only log summary, not individual results (reduces memory usage)
      // Log validation results (only invalid ones to reduce memory)
      const invalidResults = validationResults.filter((r) => !r.valid);
      if (invalidResults.length > 0) {
        logger.info(
          `[VALIDATION] Found ${invalidResults.length} invalid fixtures (out of ${validationResults.length} total)`
        );
        // Only log first 10 invalid fixtures to reduce memory
        invalidResults.slice(0, 10).forEach((result, index) => {
          logger.info(
            `[VALIDATION] ❌ Invalid ${index + 1}/${
              invalidResults.length
            } - GameID: ${result.gameID || "N/A"}, Status: ${
              result.status
            }, URL: ${result.url ? result.url.substring(0, 60) + "..." : "N/A"}`
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
      const totalFixtures = fixturesToValidate.length;
      logger.info("[VALIDATION] Fixture validation complete", {
        total: totalFixtures,
        validated: validationResults.length,
        valid: validCount,
        invalid: invalidCount,
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        teamIdsCount: teamIds.length,
      });

      // MEMORY OPTIMIZATION: Return only minimal data
      // Don't return full fixture objects - only validation results with IDs
      // The comparison service only needs ID and gameID, not full fixture objects
      const minimalFixtures = fixturesToValidate.map((f) => ({
        id: f.id,
        gameID: f.gameID,
      }));

      // Clear fixturesToValidate to free memory
      fixturesToValidate.length = 0;

      logger.info("[VALIDATION] Returning validation results (minimal data)", {
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        resultsCount: validationResults.length,
        fixturesCount: minimalFixtures.length,
      });

      // Return validation results with minimal fixture data
      return {
        validated: validationResults.length,
        valid: validCount,
        invalid: invalidCount,
        results: validationResults, // Keep validation results (needed for comparison)
        fixtures: minimalFixtures, // Only minimal data (id, gameID) - saves memory
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
