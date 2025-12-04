const logger = require("../../src/utils/logger");
const assignGameData = require("../assignCenter/assignGameData");
const getTeamsGameData = require("../scrapeCenter/GameData/getGameData");
const ProcessingTracker = require("../services/processingTracker");
const { processInParallel } = require("../utils/parallelUtils");

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
    // MEMORY FIX: Smaller batches for memory-constrained environments
    const batchSize = parseInt(process.env.GAME_DATA_BATCH_SIZE || "5", 10); // Reduced from 10 to 5
    let BatchItem = 1;
    // MEMORY FIX: Only store minimal fixture data (gameID), not full objects
    const scrapedFixtureIds = new Set(); // Use Set to avoid duplicates
    const scrapedFixturesMinimal = []; // Store minimal objects { gameID } for comparison
    try {
      // MEMORY FIX: Extract TEAMS reference before processing to allow GC of dataObj if needed
      const teams = this.dataObj.TEAMS;
      // Split teams array into smaller batches for processing
      const teamBatches = this.createBatches(teams, batchSize);

      // PARALLEL FIX: Process batches in parallel (not just items within batches)
      // This dramatically improves performance when you have many batches
      const batchConcurrency = parseInt(process.env.GAME_DATA_BATCH_CONCURRENCY || "2", 10); // Process 2 batches in parallel by default
      logger.info(
        `[GAMES] Processing ${teamBatches.length} batches with concurrency: ${batchConcurrency} (batch size: ${batchSize})`
      );

      // OPTIMIZATION: Create page pool once before parallel batch processing
      // This prevents multiple batches from checking/creating the pool simultaneously
      const { PARALLEL_CONFIG } = require("../puppeteer/constants");
      const puppeteerManager = require("../puppeteer/PuppeteerManager").getInstance();
      const concurrency = PARALLEL_CONFIG.TEAMS_CONCURRENCY;
      if (puppeteerManager.pagePool.length === 0) {
        logger.info(
          `[GAMES] Creating page pool of size ${concurrency} before parallel batch processing`
        );
        await puppeteerManager.createPagePool(concurrency);
      }

      // Process batches in parallel
      const { results: batchResults, errors: batchErrors } = await processInParallel(
        teamBatches.map((batch, index) => ({ batch, batchNumber: index + 1 })),
        async ({ batch, batchNumber }) => {
          logger.info(
            `[GAMES] [BATCH-${batchNumber}] Processing team batch ${batchNumber}/${teamBatches.length}`,
            {
              batchSize: batch.length,
              batchNumber,
              totalBatches: teamBatches.length,
            }
          );

          // Scrape game data for the current batch
          // MEMORY FIX: Only pass minimal dataObj fields needed, not full object
          let getGameDataObj = new getTeamsGameData({
            ACCOUNT: this.dataObj.ACCOUNT, // Only account info needed
            TEAMS: batch, // Only current batch of teams
            // Don't pass: Grades, COMPETITIONS, DETAILS, TYPEOBJ (not needed for game data scraping)
          });
          let scrapedGameData = await getGameDataObj.setup();

          // MEMORY FIX: Clear processor reference immediately after getting data
          getGameDataObj = null;

          if (!scrapedGameData || scrapedGameData.length === 0) {
            logger.warn(`[GAMES] [BATCH-${batchNumber}] No game data scraped for current batch.`);
            return { batchNumber, scrapedGameData: [], fixtureIds: [] };
          }

          // MEMORY FIX: Extract minimal data immediately, don't accumulate full objects
          const batchFixtureIds = [];
          scrapedGameData.forEach((fixture) => {
            if (fixture && fixture.gameID) {
              const gameID = fixture.gameID;
              batchFixtureIds.push(gameID);
            }
          });

          // ========================================
          // [DEBUG] LOG SCRAPED DATA BEFORE SENDING TO CMS
          // ========================================
          logger.info(`[GAMES] [BATCH-${batchNumber}] ===== SCRAPED DATA BEFORE CMS =====`, {
            accountId: this.dataObj.ACCOUNT.ACCOUNTID,
            batchNumber,
            scrapedCount: scrapedGameData ? scrapedGameData.length : 0,
            isArray: Array.isArray(scrapedGameData),
            dataType: scrapedGameData ? typeof scrapedGameData : "null/undefined",
          });

          if (scrapedGameData && Array.isArray(scrapedGameData)) {
            logger.info(
              `[GAMES] [BATCH-${batchNumber}] ===== SCRAPED ${scrapedGameData.length} FIXTURES =====`
            );

            // Log summary for this batch
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
              `[GAMES] [BATCH-${batchNumber}] Summary: ${scrapedGameData.length} fixtures scraped`,
              {
                batchNumber,
                totalFixtures: scrapedGameData.length,
                uniqueGrades: uniqueGrades.length,
                uniqueStatuses: uniqueStatuses.length,
                uniqueRounds: uniqueRounds.length,
              }
            );
          } else {
            logger.warn(`[GAMES] [BATCH-${batchNumber}] Scraped data is not an array:`, {
              data: scrapedGameData,
              type: typeof scrapedGameData,
            });
          }
          logger.info(`[GAMES] [BATCH-${batchNumber}] ===== END SCRAPED DATA LOG =====`);

          // Return scraped data and fixture IDs for aggregation
          return {
            batchNumber,
            scrapedGameData,
            fixtureIds: batchFixtureIds,
          };
        },
        batchConcurrency,
        {
          context: "game_data_batches",
          logProgress: true,
          continueOnError: true,
        }
      );

      // Aggregate results from all batches (thread-safe aggregation)
      const allScrapedGameData = [];
      for (const batchResult of batchResults) {
        if (batchResult && batchResult.scrapedGameData) {
          allScrapedGameData.push(...batchResult.scrapedGameData);

          // Aggregate fixture IDs (thread-safe - Set handles duplicates)
          if (batchResult.fixtureIds) {
            batchResult.fixtureIds.forEach((gameID) => {
              if (!scrapedFixtureIds.has(gameID)) {
                scrapedFixtureIds.add(gameID);
                scrapedFixturesMinimal.push({ gameID });
              }
            });
          }
        }
      }

      // Log batch processing errors if any
      if (batchErrors.length > 0) {
        logger.warn(`[GAMES] ${batchErrors.length} batches failed during scraping`, {
          errors: batchErrors.map((e) => e.message),
        });
      }

      // Assign scraped data sequentially to avoid overwhelming the API
      // Process in batches to manage memory
      const assignmentBatchSize = parseInt(process.env.GAME_DATA_ASSIGNMENT_BATCH_SIZE || "10", 10);
      const assignmentBatches = this.createBatches(allScrapedGameData, assignmentBatchSize);

      logger.info(
        `[GAMES] Assigning ${allScrapedGameData.length} fixtures in ${assignmentBatches.length} assignment batches`
      );

      for (let i = 0; i < assignmentBatches.length; i++) {
        const assignmentBatch = assignmentBatches[i];
        logger.info(
          `[GAMES] Assigning batch ${i + 1}/${assignmentBatches.length} (${assignmentBatch.length} fixtures)`
        );

        let assignGameDataObj = new assignGameData(assignmentBatch, this.dataObj);
        await assignGameDataObj.setup();

        // MEMORY FIX: Clear references immediately after processing
        assignGameDataObj = null;

        // MEMORY FIX: Force GC hint after every 2 assignment batches
        if ((i + 1) % 2 === 0 && global.gc) {
          global.gc();
        }
      }

      // Clear scraped data after assignment
      allScrapedGameData.length = 0;

      logger.info(
        `[GAMES] Scraped ${scrapedFixtureIds.size} unique fixtures total across ${teamBatches.length} batches (processed ${batchConcurrency} batches in parallel)`
      );

      // MEMORY FIX: Return minimal objects { gameID } instead of full fixture objects
      // This is compatible with FixtureComparisonService which extracts gameID from objects
      return {
        process: true,
        scrapedFixtures: scrapedFixturesMinimal, // Return minimal objects for comparison
      };
    } catch (error) {
      this.processingTracker.errorDetected("games");
      logger.error("Error in GameDataProcessor process method", {
        error,
        method: "process",
        class: "GameDataProcessor",
      });
      throw error;
    } finally {
      // MEMORY FIX: Clear dataObj reference after processing to free large arrays
      // This allows GC to free TEAMS, Grades, COMPETITIONS arrays
      this.dataObj = null;
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
