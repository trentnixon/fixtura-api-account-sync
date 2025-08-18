const logger = require("../../../src/utils/logger");

/**
 * PageAnalyzer class handles essential page analysis for debugging
 */
class PageAnalyzer {
  constructor(page) {
    this.page = page;
  }

  /**
   * Gets essential page information for debugging
   * @returns {Promise<Object>} Page analysis object
   */
  async analyzePage() {
    try {
      const analysis = {
        basicInfo: await this.getBasicInfo(),
        tableInfo: await this.getTableInfo(),
      };

      return analysis;
    } catch (error) {
      logger.warn("Could not analyze page:", error.message);
      return {};
    }
  }

  /**
   * Gets basic page information
   * @returns {Promise<Object>} Basic page info
   */
  async getBasicInfo() {
    try {
      return {
        title: await this.page.title(),
        url: this.page.url(),
      };
    } catch (error) {
      logger.warn("Could not get basic page info:", error.message);
      return {};
    }
  }

  /**
   * Gets information about tables on the page
   * @returns {Promise<Object>} Table information
   */
  async getTableInfo() {
    try {
      // Check for tables specifically within the ladder container
      const tablesInLadder = await this.page.$$('[data-testid="ladder"] table');
      const totalTables = await this.page.$$("table");

      // Check for team links in ladder tables
      const teamLinksInLadder = await this.page.$$(
        '[data-testid="ladder"] table tbody tr td a[href*="/teams/"]'
      );

      return {
        tablesInLadder: tablesInLadder.length,
        totalTables: totalTables.length,
        teamLinksInLadder: teamLinksInLadder.length,
        hasLadderTables: tablesInLadder.length > 0,
        hasTeamLinks: teamLinksInLadder.length > 0,
      };
    } catch (error) {
      logger.warn("Could not get table information:", error.message);
      return {
        tablesInLadder: 0,
        totalTables: 0,
        teamLinksInLadder: 0,
        hasLadderTables: false,
        hasTeamLinks: false,
      };
    }
  }

  /**
   * Logs page analysis information
   * @param {Object} analysis - Page analysis object
   */
  logAnalysis(analysis) {
    logger.info("=== PAGE ANALYSIS ===");

    if (analysis.basicInfo) {
      logger.info(`Page title: ${analysis.basicInfo.title}`);
      logger.info(`Current URL: ${analysis.basicInfo.url}`);
    }

    if (analysis.tableInfo) {
      logger.info(`Found ${analysis.tableInfo.totalTables} tables on the page`);
      if (analysis.tableInfo.tablesInLadder > 0) {
        logger.info(
          `Found ${analysis.tableInfo.tablesInLadder} tables within the ladder container`
        );
      }
      if (analysis.tableInfo.teamLinksInLadder > 0) {
        logger.info(
          `Found ${analysis.tableInfo.teamLinksInLadder} team links within the ladder container`
        );
      }
    }

    logger.info("=== END PAGE ANALYSIS ===");
  }
}

module.exports = PageAnalyzer;
