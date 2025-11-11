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
    // Use Puppeteer for accurate validation (default: true)
    // Reduce concurrency for Puppeteer since it's slower but more accurate
    this.validationService = new FixtureValidationService({
      usePuppeteer: options.usePuppeteer !== false, // Default to true
      timeout: options.timeout || 30000, // 30 seconds for Puppeteer
    });
    this.processingTracker = ProcessingTracker.getInstance();
    // Lower concurrency for Puppeteer (2-3) vs HTTP (5-10)
    // Puppeteer is slower but more accurate for JS-rendered pages
    this.concurrencyLimit =
      options.concurrencyLimit || (options.usePuppeteer !== false ? 2 : 5);
    this.validationResults = [];
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

      // Get team IDs and fetch fixtures (only from today onwards)
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

      // Fetch existing fixtures for teams (only from today onwards, with batching)
      logger.info(
        `Fetching existing fixtures (from today onwards) for ${teamIds.length} teams (batched)`
      );
      const databaseFixtures = await this.gameCRUD.getFixturesForTeams(teamIds);

      if (!databaseFixtures || databaseFixtures.length === 0) {
        logger.info(
          "No existing fixtures found in database (from today onwards)"
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
        `Found ${databaseFixtures.length} existing fixtures (from today onwards)`
      );
      this.processingTracker.itemFound(
        "fixture-validation",
        databaseFixtures.length
      );

      // Log first fixture structure to understand the format
      if (databaseFixtures.length > 0) {
        try {
          const firstFixtureStr = JSON.stringify(databaseFixtures[0], null, 2);
          logger.info(
            `Sample fixture structure (first 1000 chars): ${firstFixtureStr.substring(
              0,
              1000
            )}`
          );
        } catch (error) {
          logger.info(
            `Sample fixture structure (could not stringify): ${Object.keys(
              databaseFixtures[0]
            ).join(", ")}`
          );
        }
      }

      // Log each fixture with key details
      logger.info("=== FIXTURES FOUND ===");
      databaseFixtures.forEach((fixture, index) => {
        // Handle Strapi v4 structure: id at root, other fields in attributes
        // Also handle direct structure (if attributes don't exist)
        const fixtureId = fixture.id;
        const attributes = fixture.attributes || fixture;

        const gameID = attributes.gameID || fixture.gameID;
        const urlToScoreCard =
          attributes.urlToScoreCard || fixture.urlToScoreCard;
        const dayOne = attributes.dayOne || fixture.dayOne;
        const round = attributes.round || fixture.round;
        const status = attributes.status || fixture.status;
        const teams =
          attributes.teams?.data ||
          attributes.teams ||
          fixture.teams?.data ||
          fixture.teams;

        // Extract team names if available
        let teamNames = "N/A";
        if (teams && Array.isArray(teams)) {
          teamNames = teams
            .map((team) => {
              const teamData = team.attributes || team;
              return teamData.teamName || teamData.name || teamData.id;
            })
            .join(" vs ");
        }

        // Format URL for display
        const urlDisplay = urlToScoreCard
          ? urlToScoreCard.length > 60
            ? urlToScoreCard.substring(0, 60) + "..."
            : urlToScoreCard
          : "N/A";

        // Format dayOne for display
        const dayOneDisplay = dayOne
          ? typeof dayOne === "string"
            ? dayOne
            : new Date(dayOne).toISOString().split("T")[0]
          : "N/A";

        // Build log message with all data
        logger.info(
          `Fixture ${index + 1}/${databaseFixtures.length} - ID: ${
            fixtureId || "N/A"
          }, GameID: ${gameID || "N/A"}, Date: ${dayOneDisplay}, Round: ${
            round || "N/A"
          }, Status: ${
            status || "N/A"
          }, Teams: ${teamNames}, URL: ${urlDisplay}`
        );
      });
      logger.info("=== END OF FIXTURES ===");

      // ========================================
      // STEP 2: VALIDATE FIXTURE URLs
      // ========================================
      logger.info("Starting URL validation for fixtures...");

      // Prepare fixtures for validation
      const fixturesToValidate = databaseFixtures.map((fixture) => {
        const fixtureId = fixture.id;
        const attributes = fixture.attributes || fixture;
        return {
          id: fixtureId,
          gameID: attributes.gameID || fixture.gameID,
          urlToScoreCard: attributes.urlToScoreCard || fixture.urlToScoreCard,
          attributes: attributes, // Keep full attributes for reference
        };
      });

      // Validate fixtures in batches
      logger.info(
        `Validating ${fixturesToValidate.length} fixture URLs using Puppeteer (concurrency: ${this.concurrencyLimit}, timeout: ${this.validationService.timeout}ms)`
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

      // Log validation results
      logger.info("[VALIDATION] === VALIDATION RESULTS ===");
      validationResults.forEach((result, index) => {
        const statusEmoji = result.valid ? "✅" : "❌";
        const urlDisplay = result.url
          ? result.url.length > 80
            ? result.url.substring(0, 80) + "..."
            : result.url
          : "N/A";

        const httpStatusDisplay = result.httpStatus
          ? `, HTTP: ${result.httpStatus}`
          : "";
        const finalUrlDisplay =
          result.finalUrl && result.finalUrl !== result.url
            ? `, Final URL: ${result.finalUrl.substring(0, 60)}...`
            : "";

        logger.info(
          `[VALIDATION] ${statusEmoji} Fixture ${index + 1}/${
            validationResults.length
          } - GameID: ${result.gameID || "N/A"}, Status: ${
            result.status
          }, Valid: ${
            result.valid
          }${httpStatusDisplay}${finalUrlDisplay}, URL: ${urlDisplay}${
            result.error ? `, Error: ${result.error}` : ""
          }`
        );
      });
      logger.info("[VALIDATION] === END OF VALIDATION RESULTS ===");

      // Log summary of invalid fixtures
      const invalidFixtures = validationResults.filter((r) => !r.valid);
      if (invalidFixtures.length > 0) {
        logger.info(
          `[VALIDATION] === INVALID FIXTURES SUMMARY (${invalidFixtures.length} total) ===`
        );
        invalidFixtures.forEach((result, index) => {
          logger.info(
            `[VALIDATION] ❌ Invalid Fixture ${index + 1}/${
              invalidFixtures.length
            } - GameID: ${result.gameID || "N/A"}, Status: ${
              result.status
            }, URL: ${result.url || "N/A"}`
          );
        });
        logger.info("[VALIDATION] === END OF INVALID FIXTURES SUMMARY ===");
      }

      // Summary log
      logger.info("[VALIDATION] Fixture validation complete", {
        total: databaseFixtures.length,
        validated: validationResults.length,
        valid: validCount,
        invalid: invalidCount,
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        teamIdsCount: teamIds.length,
      });

      logger.info("[VALIDATION] Returning validation results", {
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        resultsCount: validationResults.length,
        fixturesCount: databaseFixtures.length,
      });

      // Return validation results
      return {
        validated: validationResults.length,
        valid: validCount,
        invalid: invalidCount,
        results: validationResults,
        fixtures: databaseFixtures,
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
