const GameDataProcessor = require("../../../processors/gameDataProcessor");
const logger = require("../../../../src/utils/logger");

/**
 * Game processing component
 */
class GameProcessorComponent {
  /**
   * Process games for the given data object
   * @param {object} dataObj - The data object containing account and game data
   * @returns {Promise<object>} - Object containing scraped fixtures array
   */
  static async process(dataObj) {
    let gameDataProcessor = null;
    try {
      logger.info("[GAMES] Starting game data processing", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Process and assign game data
      logger.info("[GAMES] Creating GameDataProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      gameDataProcessor = new GameDataProcessor(dataObj);

      logger.info("[GAMES] Calling gameDataProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const result = await gameDataProcessor.process();
      logger.info("[GAMES] gameDataProcessor.process() returned", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        hasResult: !!result,
        hasScrapedFixtures: !!(result && result.scrapedFixtures),
        scrapedFixturesCount:
          result && result.scrapedFixtures ? result.scrapedFixtures.length : 0,
      });

      logger.info("[GAMES] ProcessGames completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedFixturesCount: result?.scrapedFixtures?.length || 0,
      });

      return {
        scrapedFixtures: result?.scrapedFixtures || [],
      };
    } catch (error) {
      logger.error("[GAMES] Error in ProcessGames:", error);

      // Check if it's a connection-related error
      if (error.message && error.message.includes("ECONNREFUSED")) {
        logger.critical(
          "[GAMES] API connection failed during game processing. Please check your API server status.",
          {
            method: "ProcessGames",
            class: "DataController",
            error: error.message,
            accountId: dataObj.ACCOUNT.ACCOUNTID,
          }
        );
      }

      // Re-throw the error to be handled by the main try-catch
      throw error;
    } finally {
      // MEMORY FIX: Clear processor reference immediately after use
      if (gameDataProcessor) {
        gameDataProcessor = null;
      }
    }
  }
}

module.exports = GameProcessorComponent;

