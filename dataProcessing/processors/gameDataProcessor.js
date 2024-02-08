const logger = require("../../src/utils/logger");
const assignGameData = require("../assignCenter/assignGameData");
const getTeamsGameData = require("../scrapeCenter/GameData/getGameData");
const ProcessingTracker = require("../services/ProcessingTracker");

/**
 * GameDataProcessor class handles the overall process of fetching and assigning game data.
 * It orchestrates the workflow of scraping game data and assigning it to Strapi.
 */
class GameDataProcessor {
  constructor(dataObj) {
    this.dataObj = dataObj;
    this.processingTracker = ProcessingTracker.getInstance();
  }

  /**
   * Main processing method for game data.
   * It scrapes the game data and assigns it using respective classes.
   * Throws an error if any step in the process fails.
   */
  async process() {
    try {
      // Scrape game data 
      const getGameDataObj = new getTeamsGameData(this.dataObj);
      const scrapedGameData = await getGameDataObj.setup(); 

      if (!scrapedGameData) {
        throw new Error("No game data scraped."); 
      }
      

      // Assign scraped data
      const assignGameDataObj = new assignGameData(
        scrapedGameData,
        this.dataObj
      );
      await assignGameDataObj.setup();

      return { process: true };
    } catch (error) {
      this.processingTracker.errorDetected("games");
      logger.error("Error in GameDataProcessor process method", {
        error,
        method: "process",
        class: "GameDataProcessor",
      });
      throw error;
    }
  }
}

module.exports = GameDataProcessor;
