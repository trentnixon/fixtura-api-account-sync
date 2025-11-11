const logger = require("../../src/utils/logger");

/**
 * FixtureComparisonService compares scraped fixtures with existing database fixtures.
 * Identifies fixtures that are missing from scraped data or have invalid URLs.
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

      databaseFixtures.forEach((dbFixture) => {
        const gameID = dbFixture.gameID || dbFixture.attributes?.gameID;
        const fixtureId = dbFixture.id || dbFixture.attributes?.id;

        if (!gameID) {
          logger.warn(
            `Database fixture ${fixtureId} has no gameID, skipping comparison`
          );
          return;
        }

        // Check validation results
        const validationResult = validationMap.get(gameID);
        const hasInvalidUrl = validationResult && !validationResult.valid;

        // Check if fixture exists in scraped data
        const existsInScraped = scrapedGameIDs.has(gameID);

        // Priority: Invalid URL takes precedence over missing from scraped
        // If URL is invalid (404), delete it regardless of scraped status
        if (hasInvalidUrl) {
          // Fixture has invalid URL (404 or other error)
          invalidFixtures.push({
            fixtureId,
            gameID,
            reason: `Invalid URL: ${validationResult.status}`,
            validationResult,
            dbFixture,
          });
          fixturesToDelete.push({
            fixtureId,
            gameID,
            reason: "invalid_url",
            status: validationResult.status,
          });
        } else if (!existsInScraped && scrapedFixtures.length > 0) {
          // Only mark as missing if we actually scraped fixtures
          // If no fixtures were scraped, we can't determine if it's missing
          missingFixtures.push({
            fixtureId,
            gameID,
            reason: "missing_from_scraped_data",
            dbFixture,
          });
          fixturesToDelete.push({
            fixtureId,
            gameID,
            reason: "missing_from_source",
          });
        } else {
          // Fixture exists in scraped data and has valid URL
          // OR no scraped data available and no invalid URL found
          fixturesToKeep.push({
            fixtureId,
            gameID,
            dbFixture,
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
   * @param {Array<Object>} fixturesToDelete - Fixtures marked for deletion
   * @param {Object} options - Filtering options
   * @param {boolean} options.deleteInvalidUrls - Whether to delete fixtures with invalid URLs
   * @param {boolean} options.deleteMissing - Whether to delete fixtures missing from scraped data
   * @returns {Array<Object>} Filtered fixtures to delete
   */
  filterFixturesToDelete(fixturesToDelete, options = {}) {
    const { deleteInvalidUrls = true, deleteMissing = true } = options;

    return fixturesToDelete.filter((fixture) => {
      if (fixture.reason === "invalid_url" && !deleteInvalidUrls) {
        return false;
      }
      if (fixture.reason === "missing_from_source" && !deleteMissing) {
        return false;
      }
      return true;
    });
  }
}

module.exports = FixtureComparisonService;
