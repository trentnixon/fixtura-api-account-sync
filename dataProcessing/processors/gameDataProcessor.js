const logger = require("../../src/utils/logger");
const assignGameData = require("../assignCenter/assignGameData");
const getTeamsGameData = require("../scrapeCenter/GameData/getGameData");
const ProcessingTracker = require("../services/processingTracker");

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
    const batchSize = 10;
    let BatchItem = 1;
    const allScrapedFixtures = []; // Store all scraped fixtures for comparison
    try {
      // Split teams array into smaller batches for processing
      const teamBatches = this.createBatches(this.dataObj.TEAMS, batchSize);

      // Loop through each batch
      for (const teamsBatch of teamBatches) {
        logger.info(
          `Processing team batch ${BatchItem}/${teamBatches.length}`,
          {
            batchSize: teamsBatch.length,
            batchNumber: BatchItem,
            totalBatches: teamBatches.length,
          }
        );
        // Scrape game data for the current batch
        const getGameDataObj = new getTeamsGameData({
          ...this.dataObj,
          TEAMS: teamsBatch,
        });
        const scrapedGameData = await getGameDataObj.setup();

        if (!scrapedGameData || scrapedGameData.length === 0) {
          logger.warn("No game data scraped for current batch.");
          continue;
        }

        // Store scraped fixtures for later comparison
        allScrapedFixtures.push(...scrapedGameData);

        // Assign the scraped data for the current batch
        const assignGameDataObj = new assignGameData(
          scrapedGameData,
          this.dataObj
        );
        await assignGameDataObj.setup();
        BatchItem++;
      }

      logger.info(
        `Scraped ${allScrapedFixtures.length} fixtures total across ${
          BatchItem - 1
        } batches`
      );

      return {
        process: true,
        scrapedFixtures: allScrapedFixtures, // Return scraped fixtures for comparison
      };
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

  // Helper function to split array into batches
  createBatches(array, batchSize) {
    let batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

module.exports = GameDataProcessor;
