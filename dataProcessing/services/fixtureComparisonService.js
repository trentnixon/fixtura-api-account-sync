const logger = require("../../src/utils/logger");

/**
 * FixtureComparisonService compares scraped fixtures with existing database fixtures.
 * ONLY flags fixtures for deletion if they have a 404 status.
 * Missing fixtures are tracked for logging but not flagged for deletion.
 */
class FixtureComparisonService {
  constructor(dataObj) {
    this.dataObj = dataObj;
  }

  /**
   * Compares scraped fixtures with database fixtures and validation results
   * @param {Array<Object>} scrapedFixtures - Fixtures scraped from PlayHQ (with gameID)
   * @param {Array<Object>} databaseFixtures - Fixtures from database (with gameID, id)
   * @param {Array<Object>} validationResults - Validation results from FixtureValidationService
   * @returns {Object} Comparison result with fixtures to delete
   */
  compareFixtures(
    scrapedFixtures = [],
    databaseFixtures = [],
    validationResults = []
  ) {
    try {
      // Handle empty inputs
      if (!scrapedFixtures) scrapedFixtures = [];
      if (!databaseFixtures) databaseFixtures = [];
      if (!validationResults) validationResults = [];

      // Create maps for easier lookup
      const scrapedGameIDs = new Set(
        scrapedFixtures
          .map((f) => f.gameID || f.attributes?.gameID)
          .filter(Boolean)
      );
      const validationMap = new Map();
      validationResults.forEach((result) => {
        if (result.gameID) {
          validationMap.set(result.gameID, result);
        }
      });

      // Categorize database fixtures
      const fixturesToDelete = [];
      const fixturesToKeep = [];
      const invalidFixtures = [];
      const missingFixtures = [];

      // MEMORY OPTIMIZATION: databaseFixtures now contains minimal data { id, gameID }
      // No need to check attributes - data is already minimal
      databaseFixtures.forEach((dbFixture) => {
        const gameID = dbFixture.gameID;
        const fixtureId = dbFixture.id;

        if (!gameID) {
          logger.warn(
            `Database fixture ${fixtureId} has no gameID, skipping comparison`
          );
          return;
        }

        // Check validation results
        const validationResult = validationMap.get(gameID);
        const has404Status = validationResult && validationResult.status === "404";

        // Check if fixture exists in scraped data (for logging only, not for deletion)
        const existsInScraped = scrapedGameIDs.has(gameID);

        // ONLY flag for deletion if status is 404
        // Do not delete fixtures missing from scraped data or with other error statuses
        if (has404Status) {
          // Fixture has 404 status - flag for deletion
          // MEMORY OPTIMIZATION: Don't store full validationResult or dbFixture
          // Only store minimal data needed for deletion
          invalidFixtures.push({
            fixtureId,
            gameID,
            reason: `404 status: ${validationResult.status}`,
            status: validationResult.status, // Only store status, not full result
          });
          fixturesToDelete.push({
            fixtureId,
            gameID,
            reason: "404_status",
            status: validationResult.status,
          });
        } else if (!existsInScraped && scrapedFixtures.length > 0) {
          // Track missing fixtures for logging, but DO NOT flag for deletion
          // MEMORY OPTIMIZATION: Don't store dbFixture
          missingFixtures.push({
            fixtureId,
            gameID,
            reason: "missing_from_scraped_data",
          });
          // Do not add to fixturesToDelete - only 404 status triggers deletion
        } else {
          // Fixture exists in scraped data and has valid URL
          // OR no scraped data available and no 404 status found
          // MEMORY OPTIMIZATION: Don't store dbFixture
          fixturesToKeep.push({
            fixtureId,
            gameID,
          });
        }
      });

      // Log comparison results
      logger.info(`[CLEANUP] Fixture comparison complete:`, {
        totalScraped: scrapedFixtures.length,
        totalDatabase: databaseFixtures.length,
        toKeep: fixturesToKeep.length,
        toDelete: fixturesToDelete.length,
        invalidUrls: invalidFixtures.length,
        missingFromSource: missingFixtures.length,
      });

      return {
        fixturesToDelete,
        fixturesToKeep,
        invalidFixtures,
        missingFixtures,
        summary: {
          totalScraped: scrapedFixtures.length,
          totalDatabase: databaseFixtures.length,
          toKeep: fixturesToKeep.length,
          toDelete: fixturesToDelete.length,
          invalidUrls: invalidFixtures.length,
          missingFromSource: missingFixtures.length,
        },
      };
    } catch (error) {
      logger.error("Error in fixture comparison", {
        error: error.message,
        stack: error.stack,
        class: "FixtureComparisonService",
      });
      throw error;
    }
  }

  /**
   * Filters fixtures to delete based on configuration
   * @param {Array<Object>} fixturesToDelete - Fixtures marked for deletion (only 404 status)
   * @param {Object} options - Filtering options
   * @param {boolean} options.delete404 - Whether to delete fixtures with 404 status (default: true)
   * @returns {Array<Object>} Filtered fixtures to delete
   */
  filterFixturesToDelete(fixturesToDelete, options = {}) {
    const { delete404 = true } = options;

    return fixturesToDelete.filter((fixture) => {
      // Only 404 status fixtures are in fixturesToDelete now
      if (fixture.reason === "404_status" && !delete404) {
        return false;
      }
      return true;
    });
  }
}

module.exports = FixtureComparisonService;
