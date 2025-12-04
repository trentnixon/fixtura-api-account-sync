const CompetitionProcessor = require("../../../processors/competitionProcessor");
const logger = require("../../../../src/utils/logger");

/**
 * Competition processing component
 */
class CompetitionProcessorComponent {
  /**
   * Process competitions for the given data object
   * @param {object} dataObj - The data object containing account and competition data
   */
  static async process(dataObj) {
    let competitionProcessor = null;
    try {
      logger.info("[COMPETITIONS] Starting competition processing", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Process and assign competitions
      logger.info("[COMPETITIONS] Creating CompetitionProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      competitionProcessor = new CompetitionProcessor(dataObj);

      logger.info("[COMPETITIONS] Calling competitionProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await competitionProcessor.process();

      logger.info("[COMPETITIONS] ProcessCompetitions completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } catch (error) {
      logger.error("[COMPETITIONS] Error in ProcessCompetitions:", error);
      throw error;
    } finally {
      // MEMORY FIX: Clear processor reference immediately after use
      if (competitionProcessor) {
        competitionProcessor = null;
      }
    }
  }
}

module.exports = CompetitionProcessorComponent;

