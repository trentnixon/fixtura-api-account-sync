const TeamProcessor = require("../../../processors/teamProcessor");
const logger = require("../../../../src/utils/logger");

/**
 * Team processing component
 */
class TeamProcessorComponent {
  /**
   * Process teams for the given data object
   * @param {object} dataObj - The data object containing account and team data
   */
  static async process(dataObj) {
    let teamProcessor = null;
    try {
      logger.info("[TEAMS] Starting team processing", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Process and assign teams
      logger.info("[TEAMS] Creating TeamProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      teamProcessor = new TeamProcessor(dataObj);

      logger.info("[TEAMS] Calling teamProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await teamProcessor.process();

      logger.info("[TEAMS] ProcessTeams completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } catch (error) {
      logger.error("[TEAMS] Error in ProcessTeams:", error);
      throw error;
    } finally {
      // MEMORY FIX: Clear processor reference immediately after use
      if (teamProcessor) {
        teamProcessor = null;
      }
    }
  }
}

module.exports = TeamProcessorComponent;

