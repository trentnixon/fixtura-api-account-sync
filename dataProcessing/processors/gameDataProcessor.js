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
        let scrapedGameData = await getGameDataObj.setup();

        if (!scrapedGameData || scrapedGameData.length === 0) {
          logger.warn("No game data scraped for current batch.");
          continue;
        }

        // Store scraped fixtures for later comparison
        allScrapedFixtures.push(...scrapedGameData);

        // ========================================
        // [DEBUG] LOG SCRAPED DATA BEFORE SENDING TO CMS
        // ========================================
        logger.info("[GAMES] ===== SCRAPED DATA BEFORE CMS =====", {
          accountId: this.dataObj.ACCOUNT.ACCOUNTID,
          batchNumber: BatchItem,
          scrapedCount: scrapedGameData ? scrapedGameData.length : 0,
          isArray: Array.isArray(scrapedGameData),
          dataType: scrapedGameData ? typeof scrapedGameData : "null/undefined",
        });

        if (scrapedGameData && Array.isArray(scrapedGameData)) {
          logger.info(
            `[GAMES] ===== SCRAPED ${scrapedGameData.length} FIXTURES (Batch ${BatchItem}) =====`
          );

          // Log each fixture individually for better visibility (limit to first 10 for readability)
          const fixturesToLog = scrapedGameData.slice(0, 10);
          fixturesToLog.forEach((fixture, index) => {
            const fixtureData = {
              gameID: fixture?.gameID || "N/A",
              round: fixture?.round || "N/A",
              date: fixture?.date || "N/A",
              status: fixture?.status || "N/A",
              teamHome: fixture?.teamHome || "N/A",
              teamAway: fixture?.teamAway || "N/A",
              teamHomeID: fixture?.teamHomeID || "N/A",
              teamAwayID: fixture?.teamAwayID || "N/A",
              grade: fixture?.grade || [],
              type: fixture?.type || "N/A",
              time: fixture?.time || "N/A",
              ground: fixture?.ground || "N/A",
              urlToScoreCard: fixture?.urlToScoreCard || "N/A",
            };

            logger.info(
              `[GAMES] Fixture ${index + 1}/${fixturesToLog.length}: ${fixtureData.teamHome} vs ${fixtureData.teamAway} (GameID: ${fixtureData.gameID})`
            );
            logger.info(
              `[GAMES]   Round: ${fixtureData.round}, Date: ${fixtureData.date}, Status: ${fixtureData.status}`
            );
            logger.info(
              `[GAMES]   Type: ${fixtureData.type}, Time: ${fixtureData.time}, Ground: ${fixtureData.ground}`
            );
            logger.info(
              `[GAMES]   Grade: ${fixtureData.grade.join(", ") || "N/A"}, ScoreCard: ${fixtureData.urlToScoreCard}`
            );
          });

          if (scrapedGameData.length > 10) {
            logger.info(
              `[GAMES] ... and ${scrapedGameData.length - 10} more fixtures in this batch`
            );
          }

          // Also log summary for this batch
          const uniqueGrades = [
            ...new Set(scrapedGameData.flatMap((f) => f?.grade || [])),
          ];
          const uniqueStatuses = [
            ...new Set(scrapedGameData.map((f) => f?.status || "Unknown")),
          ];
          const uniqueRounds = [
            ...new Set(scrapedGameData.map((f) => f?.round || "Unknown")),
          ];

          logger.info(
            `[GAMES] Batch ${BatchItem} Summary: ${scrapedGameData.length} fixtures scraped`,
            {
              batchNumber: BatchItem,
              totalFixtures: scrapedGameData.length,
              uniqueGrades: uniqueGrades.length,
              uniqueStatuses: uniqueStatuses.length,
              uniqueRounds: uniqueRounds.length,
            }
          );
        } else {
          logger.warn("[GAMES] Scraped data is not an array:", {
            data: scrapedGameData,
            type: typeof scrapedGameData,
          });
        }
        logger.info("[GAMES] ===== END SCRAPED DATA LOG =====");

        // Assign the scraped data for the current batch
        const assignGameDataObj = new assignGameData(
          scrapedGameData,
          this.dataObj
        );
        await assignGameDataObj.setup();

        // MEMORY OPTIMIZATION: scrapedGameData will be garbage collected after this iteration
        // The data is already stored in allScrapedFixtures and assigned to CMS

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
