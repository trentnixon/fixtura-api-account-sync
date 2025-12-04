const errorHandler = require("../../../utils/errorHandler");
const logger = require("../../../../src/utils/logger");

/**
 * Data synchronization operations
 */
class DataSyncOperations {
  constructor(dataService, fromRedis) {
    this.dataService = dataService;
    this.fromRedis = fromRedis;
  }

  /**
   * Re-sync data from Redis/account source
   */
  async reSyncData() {
    return await this.dataService.fetchData(this.fromRedis);
  }

  /**
   * Re-sync data using direct org ID (bypasses account lookup).
   * Used for direct club/association ID processing.
   *
   * @param {number} orgId - The organization ID (club or association ID)
   * @param {string} orgType - The organization type ("CLUB" or "ASSOCIATION")
   * @returns {Promise<object>} - Structured data object with pseudo account ID
   */
  async reSyncDataDirect(orgId, orgType) {
    return await this.dataService.fetchDataDirect(orgId, orgType);
  }

  /**
   * Update account data only - fetches fresh account data without processing competitions, teams, or games.
   * This is used for on-demand account updates that only refresh account metadata.
   */
  async updateAccountOnly() {
    try {
      // Fetch fresh account data from CMS
      const dataObj = await this.reSyncData();

      logger.info(
        `Account data fetched successfully for account ${dataObj.ACCOUNT.ACCOUNTID} (${dataObj.ACCOUNT.ACCOUNTTYPE})`
      );

      // Return success without processing competitions, teams, or games
      return { Complete: true, accountId: dataObj.ACCOUNT.ACCOUNTID };
    } catch (error) {
      errorHandler.handle(error, "DataController");
      logger.error("Error in updateAccountOnly:", {
        accountId: this.fromRedis?.ID,
        error: error.message,
      });
      return { Complete: false };
    }
  }
}

module.exports = DataSyncOperations;

