const logger = require("../../../../src/utils/logger");

/**
 * Helper methods for validation processing
 */
class ValidationHelpers {
  /**
   * Get team IDs from dataObj
   * @param {Object} dataObj - Data object containing teams
   * @returns {Array<number>} Array of team database IDs
   */
  static getTeamIds(dataObj) {
    if (!dataObj.TEAMS || !Array.isArray(dataObj.TEAMS)) {
      return [];
    }

    return dataObj.TEAMS.map((team) => team.id).filter(Boolean);
  }

  /**
   * Log validation results summary
   * @param {Array} invalidResults - Invalid validation results
   * @param {number} totalFixtures - Total fixtures validated
   */
  static logValidationSummary(invalidResults, totalFixtures) {
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
  }

  /**
   * Log return summary
   * @param {Object} dataObj - Data object with account info
   * @param {number} resultsCount - Number of invalid results
   * @param {number} fixturesCount - Number of invalid fixtures
   */
  static logReturnSummary(dataObj, resultsCount, fixturesCount) {
    logger.info(
      "[VALIDATION] Returning validation results (invalid-only storage)",
      {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        resultsCount: resultsCount,
        fixturesCount: fixturesCount,
        note: "Only invalid results stored - major memory savings for large associations",
      }
    );
  }

  /**
   * Create empty result object
   * @returns {Object} Empty validation result
   */
  static createEmptyResult() {
    return {
      validated: 0,
      valid: 0,
      invalid: 0,
      results: [],
      fixtures: [],
    };
  }
}

module.exports = ValidationHelpers;

