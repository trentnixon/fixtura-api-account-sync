const logger = require("../../../../src/utils/logger");

/**
 * Handles aggregation of validation results
 * Only stores invalid fixtures to minimize memory usage
 */
class ResultAggregator {
  constructor() {
    this.invalidResults = [];
    this.invalidFixtureIds = new Set();
    this.invalidFixtureData = new Map(); // Map<id, { id, gameID }>
    this.totalValidCount = 0;
    this.totalInvalidCount = 0;
  }

  /**
   * Process validation results from a page
   * Only stores invalid fixtures, counts valid ones
   * @param {Array} pageValidationResults - Validation results from current page
   * @param {Array} pageFixtures - Fixture data from current page
   */
  processPageResults(pageValidationResults, pageFixtures) {
    // Count and store invalid results
    for (const result of pageValidationResults) {
      if (result.valid) {
        this.totalValidCount++;
      } else {
        this.totalInvalidCount++;
        // Only store invalid results (needed for cleanup)
        if (!this.invalidFixtureIds.has(result.fixtureId)) {
          this.invalidFixtureIds.add(result.fixtureId);
          this.invalidResults.push({
            fixtureId: result.fixtureId,
            gameID: result.gameID,
            valid: false,
            status: result.status,
            httpStatus: result.httpStatus,
          });
        }
      }
    }

    // MEMORY CRITICAL FIX: Only store INVALID fixtures for comparison
    // Valid fixtures don't need to be stored - they won't be deleted
    // This reduces memory from storing 10,000+ fixtures to only storing invalid ones (typically <10%)
    for (const result of pageValidationResults) {
      if (!result.valid && result.fixtureId) {
        // Find the fixture data for this invalid result
        const fixture = pageFixtures.find((f) => f.id === result.fixtureId);
        if (fixture && !this.invalidFixtureData.has(fixture.id)) {
          this.invalidFixtureData.set(fixture.id, {
            id: fixture.id,
            gameID: fixture.gameID || null,
          });
        }
      }
    }
  }

  /**
   * Get aggregated results
   * @returns {Object} Aggregated validation results
   */
  getResults() {
    return {
      invalidResults: this.invalidResults,
      invalidFixtureIds: this.invalidFixtureIds,
      invalidFixtureData: this.invalidFixtureData,
      totalValidCount: this.totalValidCount,
      totalInvalidCount: this.totalInvalidCount,
    };
  }

  /**
   * Get fixtures array for comparison service
   * @returns {Array} Array of invalid fixtures (minimal data)
   */
  getFixturesArray() {
    return Array.from(this.invalidFixtureData.values());
  }

  /**
   * Get statistics for logging
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      invalidResultsLength: this.invalidResults.length,
      invalidFixtureIdsSize: this.invalidFixtureIds.size,
      invalidFixtureDataSize: this.invalidFixtureData.size,
      totalValidCount: this.totalValidCount,
      totalInvalidCount: this.totalInvalidCount,
    };
  }
}

module.exports = ResultAggregator;

