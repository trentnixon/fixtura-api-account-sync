const logger = require("../../src/utils/logger");
const assignGameData = require("../assignCenter/assignGameData");
const getTeamsGameData = require("../scrapeCenter/GameData/getGameData");
const ProcessingTracker = require("../services/processingTracker");
const { processInParallel } = require("../utils/parallelUtils");
const PuppeteerManager = require("../puppeteer/PuppeteerManager");

/**
 * GameDataProcessor class handles the overall process of fetching and assigning game data.
 * It orchestrates the workflow of scraping game data and assigning it to Strapi.
 */
class GameDataProcessor {
  constructor(dataObj, options = {}) {
    this.dataObj = dataObj;
    this.processingTracker = ProcessingTracker.getInstance();
    this.options = {
      isolateByCategory:
        options.isolateByCategory || process.env.ISOLATE_BY_CATEGORY === "true",
      memoryTracker: options.memoryTracker || null,
      ...options,
    };
  }

  /**
   * Build a map from grade ID to competition info
   * @returns {Map<number, {compID: number, compName: string}>} Map of grade ID to competition info
   */
  buildGradeToCompetitionMap() {
    const gradeToCompMap = new Map();
    if (!this.dataObj.Grades || !Array.isArray(this.dataObj.Grades)) {
      logger.warn("[GAMES] No Grades data available for category grouping");
      return gradeToCompMap;
    }

    this.dataObj.Grades.forEach((grade) => {
      if (grade && grade.id && grade.compID) {
        gradeToCompMap.set(grade.id, {
          compID: grade.compID,
          compName: grade.compName || `Competition-${grade.compID}`,
        });
      }
    });

    logger.info(
      `[GAMES] Built grade-to-competition map: ${gradeToCompMap.size} grades mapped`
    );
    return gradeToCompMap;
  }

  /**
   * Group teams by competition/category
   * @param {Array} teams - Array of team objects
   * @param {Map} gradeToCompMap - Map of grade ID to competition info
   * @returns {Map<string, Array>} Map of competition name to teams array
   */
  groupTeamsByCategory(teams, gradeToCompMap) {
    const categoryMap = new Map();
    let ungroupedCount = 0;

    teams.forEach((team) => {
      const gradeId = team.grade;
      if (!gradeId) {
        ungroupedCount++;
        return;
      }

      const compInfo = gradeToCompMap.get(gradeId);
      if (!compInfo) {
        ungroupedCount++;
        return;
      }

      const categoryKey = `${compInfo.compName} (ID: ${compInfo.compID})`;
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          compID: compInfo.compID,
          compName: compInfo.compName,
          teams: [],
        });
      }
      categoryMap.get(categoryKey).teams.push(team);
    });

    logger.info(
      `[GAMES] Grouped ${teams.length} teams into ${categoryMap.size} categories (${ungroupedCount} ungrouped)`
    );

    // Log category breakdown with index numbers for easy testing
    logger.info(`[GAMES] ===== AVAILABLE CATEGORIES FOR TESTING =====`);
    let categoryIndex = 1;
    categoryMap.forEach((categoryData, categoryKey) => {
      logger.info(
        `[GAMES] [${categoryIndex}] Category: ${categoryKey} - ${categoryData.teams.length} teams`
      );
      categoryIndex++;
    });
    logger.info(`[GAMES] ===== END CATEGORY LIST =====`);
    logger.info(
      `[GAMES] To test a specific category, set: TEST_CATEGORY_ID=${
        Array.from(categoryMap.values())[0]?.compID
      } (or use TEST_CATEGORY_NAME)`
    );

    return categoryMap;
  }

  /**
   * Process a single category's teams
   * @param {string} categoryKey - Category identifier
   * @param {object} categoryData - Category data with teams array
   * @param {number} categoryIndex - Index of category (for logging)
   * @param {number} totalCategories - Total number of categories
   * @returns {Promise<object>} Result with scraped fixtures
   */
  async processCategory(
    categoryKey,
    categoryData,
    categoryIndex,
    totalCategories
  ) {
    const { teams, compID, compName } = categoryData;
    const categoryStartTime = Date.now();
    const isTestingSingleCategory =
      process.env.TEST_CATEGORY_ID || process.env.TEST_CATEGORY_NAME;

    logger.info(`[GAMES] ========================================`);
    logger.info(
      `[GAMES] [COMPETITION-${
        categoryIndex + 1
      }/${totalCategories}] STARTING: ${compName}`
    );
    logger.info(
      `[GAMES] [COMPETITION-${categoryIndex + 1}] Competition ID: ${compID}`
    );
    logger.info(
      `[GAMES] [COMPETITION-${categoryIndex + 1}] Teams to process: ${
        teams.length
      }`
    );
    if (isTestingSingleCategory) {
      logger.info(
        `[GAMES] [COMPETITION-${
          categoryIndex + 1
        }] ⚠️ TESTING MODE: Processing ONLY this competition`
      );
    }
    logger.info(`[GAMES] ========================================`);

    // Log memory before category processing
    if (this.options.memoryTracker) {
      const beforeStats = this.options.memoryTracker.logMemoryStats(
        `COMPETITION-${categoryIndex + 1}-START`
      );
      logger.info(
        `[GAMES] [COMPETITION-${
          categoryIndex + 1
        }] Memory BEFORE: RSS=${beforeStats.rss.toFixed(
          2
        )} MB, Heap=${beforeStats.heapUsed.toFixed(2)} MB`
      );
    }

    try {
      // When testing a single competition, process ALL teams at once (no batching)
      // When processing all competitions, use batching to manage memory
      let teamBatches;
      let batchConcurrency;

      if (isTestingSingleCategory) {
        // TESTING MODE: Process ALL teams for this competition at once
        logger.info(
          `[GAMES] [COMPETITION-${
            categoryIndex + 1
          }] TESTING MODE: Processing ALL ${
            teams.length
          } teams at once (no batching)`
        );
        teamBatches = [teams]; // Single batch with all teams
        batchConcurrency = 1; // Process sequentially to avoid overwhelming memory
      } else {
        // NORMAL MODE: Process teams in batches
        const batchSize = parseInt(process.env.GAME_DATA_BATCH_SIZE || "5", 10);
        teamBatches = this.createBatches(teams, batchSize);
        batchConcurrency = parseInt(
          process.env.GAME_DATA_BATCH_CONCURRENCY || "2",
          10
        );
        logger.info(
          `[GAMES] [COMPETITION-${categoryIndex + 1}] Processing ${
            teamBatches.length
          } batches (batch size: ${batchSize}, concurrency: ${batchConcurrency})`
        );
      }

      // Create page pool if needed
      const { PARALLEL_CONFIG } = require("../puppeteer/constants");
      const puppeteerManager = PuppeteerManager.getInstance();
      const concurrency = PARALLEL_CONFIG.TEAMS_CONCURRENCY;
      if (puppeteerManager.pagePool.length === 0) {
        logger.info(
          `[GAMES] [CATEGORY-${
            categoryIndex + 1
          }] Creating page pool of size ${concurrency}`
        );
        await puppeteerManager.createPagePool(concurrency);
      }

      // Process batches
      const { results: batchResults, errors: batchErrors } =
        await processInParallel(
          teamBatches.map((batch, index) => ({
            batch,
            batchNumber: index + 1,
          })),
          async ({ batch, batchNumber }) => {
            if (isTestingSingleCategory) {
              logger.info(
                `[GAMES] [COMPETITION-${categoryIndex + 1}] Processing ALL ${
                  batch.length
                } teams for this competition`
              );
            } else {
              logger.info(
                `[GAMES] [COMPETITION-${
                  categoryIndex + 1
                }] [BATCH-${batchNumber}] Processing ${batch.length} teams`
              );
            }

            let getGameDataObj = new getTeamsGameData({
              ACCOUNT: this.dataObj.ACCOUNT,
              TEAMS: batch,
            });
            let scrapedGameData = await getGameDataObj.setup();
            getGameDataObj = null;

            if (!scrapedGameData || scrapedGameData.length === 0) {
              return { batchNumber, scrapedGameData: [], fixtureIds: [] };
            }

            const batchFixtureIds = [];
            scrapedGameData.forEach((fixture) => {
              if (fixture && fixture.gameID) {
                batchFixtureIds.push(fixture.gameID);
              }
            });

            return {
              batchNumber,
              scrapedGameData,
              fixtureIds: batchFixtureIds,
            };
          },
          batchConcurrency,
          {
            context: `category_${categoryIndex + 1}_batches`,
            logProgress: true,
            continueOnError: true,
          }
        );

      // Aggregate results
      const categoryScrapedGameData = [];
      const categoryFixtureIds = new Set();
      for (const batchResult of batchResults) {
        if (batchResult && batchResult.scrapedGameData) {
          categoryScrapedGameData.push(...batchResult.scrapedGameData);
          if (batchResult.fixtureIds) {
            batchResult.fixtureIds.forEach((gameID) =>
              categoryFixtureIds.add(gameID)
            );
          }
        }
      }

      if (batchErrors.length > 0) {
        logger.warn(
          `[GAMES] [COMPETITION-${categoryIndex + 1}] ${
            batchErrors.length
          } batches failed`,
          { errors: batchErrors.map((e) => e.message) }
        );
      }

      const categoryDuration = Date.now() - categoryStartTime;

      // Log memory after category processing
      let afterStats = null;
      if (this.options.memoryTracker) {
        afterStats = this.options.memoryTracker.logMemoryStats(
          `COMPETITION-${categoryIndex + 1}-COMPLETE`
        );
      }

      logger.info(`[GAMES] ========================================`);
      logger.info(
        `[GAMES] [COMPETITION-${
          categoryIndex + 1
        }/${totalCategories}] COMPLETED: ${compName}`
      );
      logger.info(
        `[GAMES] [COMPETITION-${
          categoryIndex + 1
        }] Duration: ${categoryDuration}ms`
      );
      logger.info(
        `[GAMES] [COMPETITION-${categoryIndex + 1}] Fixtures scraped: ${
          categoryScrapedGameData.length
        }`
      );
      if (afterStats) {
        const beforeStats = this.options.memoryTracker?.lastMemoryLog?.stats;
        const memoryIncrease = beforeStats
          ? (afterStats.rss - beforeStats.rss).toFixed(2)
          : "N/A";
        logger.info(
          `[GAMES] [COMPETITION-${
            categoryIndex + 1
          }] Memory AFTER: RSS=${afterStats.rss.toFixed(
            2
          )} MB, Heap=${afterStats.heapUsed.toFixed(2)} MB`
        );
        logger.info(
          `[GAMES] [COMPETITION-${
            categoryIndex + 1
          }] Memory INCREASE: ${memoryIncrease} MB`
        );

        // Warn if memory is high
        if (this.options.memoryTracker.isMemoryHigh()) {
          logger.warn(
            `[GAMES] [COMPETITION-${
              categoryIndex + 1
            }] ⚠️ MEMORY WARNING: RSS=${afterStats.rss.toFixed(
              2
            )} MB exceeds threshold (${
              this.options.memoryTracker.memoryThresholdMB
            } MB)`
          );
        }
        if (this.options.memoryTracker.isMemoryCritical()) {
          logger.critical(
            `[GAMES] [COMPETITION-${
              categoryIndex + 1
            }] 🚨 MEMORY CRITICAL: RSS=${afterStats.rss.toFixed(
              2
            )} MB exceeds critical threshold (${
              this.options.memoryTracker.memoryCriticalMB
            } MB)`
          );
        }
      }
      logger.info(`[GAMES] ========================================`);

      if (isTestingSingleCategory) {
        logger.info(
          `[GAMES] [COMPETITION-${
            categoryIndex + 1
          }] ✅ TESTING COMPLETE: Only this competition was processed`
        );
      }

      return {
        categoryKey,
        compID,
        compName,
        scrapedGameData: categoryScrapedGameData,
        fixtureIds: Array.from(categoryFixtureIds),
      };
    } catch (error) {
      logger.error(
        `[GAMES] [COMPETITION-${
          categoryIndex + 1
        }] Error processing competition: ${compName}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );
      throw error;
    }
  }

  /**
   * Cleanup memory between categories
   * @param {number} categoryIndex - Current category index
   */
  async cleanupBetweenCategories(categoryIndex) {
    logger.info(
      `[GAMES] [COMPETITION-${categoryIndex + 1}] Starting memory cleanup`
    );

    try {
      const puppeteerManager = PuppeteerManager.getInstance();

      // Force browser restart if memory is high
      if (
        this.options.memoryTracker &&
        this.options.memoryTracker.isMemoryHigh()
      ) {
        logger.warn(
          `[GAMES] [COMPETITION-${
            categoryIndex + 1
          }] Memory is high - forcing browser restart`
        );
        await puppeteerManager.forceRestartBrowser();
      }

      // Cleanup orphaned pages
      await puppeteerManager.cleanupOrphanedPages();

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      // Log memory after cleanup
      if (this.options.memoryTracker) {
        this.options.memoryTracker.logMemoryStats(
          `COMPETITION-${categoryIndex + 1}-CLEANUP`
        );
      }

      logger.info(
        `[GAMES] [COMPETITION-${categoryIndex + 1}] Memory cleanup completed`
      );
    } catch (error) {
      logger.warn(
        `[GAMES] [COMPETITION-${categoryIndex + 1}] Error during cleanup`,
        {
          error: error.message,
        }
      );
      // Don't throw - cleanup errors shouldn't stop processing
    }
  }

  /**
   * Main processing method for game data.
   * It scrapes the game data and assigns it using respective classes.
   * Throws an error if any step in the process fails.
   */
  async process() {
    // MEMORY FIX: Only store minimal fixture data (gameID), not full objects
    // We assign fixtures immediately after scraping (streaming mode) - no accumulation
    const scrapedFixtureIds = new Set(); // Use Set to avoid duplicates
    const scrapedFixturesMinimal = []; // Store minimal objects { gameID } for comparison
    let batchErrors = []; // Initialize batchErrors to handle both processing paths
    let totalBatches = 0; // Track total batches for logging
    let batchConcurrency = 0; // Track batch concurrency for logging

    try {
      // MEMORY FIX: Extract TEAMS reference before processing to allow GC of dataObj if needed
      const teams = this.dataObj.TEAMS;

      // CATEGORY ISOLATION: Group teams by competition/category if enabled
      if (this.options.isolateByCategory) {
        logger.info(
          "[GAMES] Category isolation enabled - processing one category at a time"
        );

        const gradeToCompMap = this.buildGradeToCompetitionMap();
        const categoryMap = this.groupTeamsByCategory(teams, gradeToCompMap);

        if (categoryMap.size === 0) {
          logger.warn(
            "[GAMES] No categories found - falling back to standard processing"
          );
          // Fall through to standard processing
        } else {
          // Filter to specific category if TEST_CATEGORY_ID or TEST_CATEGORY_NAME is set
          let categories = Array.from(categoryMap.entries());
          const testCategoryId = process.env.TEST_CATEGORY_ID;
          const testCategoryName = process.env.TEST_CATEGORY_NAME;

          if (testCategoryId || testCategoryName) {
            const originalCount = categories.length;
            categories = categories.filter(([categoryKey, categoryData]) => {
              if (
                testCategoryId &&
                categoryData.compID.toString() === testCategoryId.toString()
              ) {
                return true;
              }
              if (
                testCategoryName &&
                categoryData.compName
                  .toLowerCase()
                  .includes(testCategoryName.toLowerCase())
              ) {
                return true;
              }
              return false;
            });

            if (categories.length === 0) {
              logger.error(
                `[GAMES] TEST_CATEGORY filter matched no categories! Filter: ID=${testCategoryId}, Name=${testCategoryName}. Available categories:`
              );
              categoryMap.forEach((categoryData, categoryKey) => {
                logger.info(
                  `[GAMES]   - ${categoryKey} (ID: ${categoryData.compID}, Name: ${categoryData.compName})`
                );
              });
              throw new Error(
                `No category found matching TEST_CATEGORY_ID=${testCategoryId} or TEST_CATEGORY_NAME=${testCategoryName}`
              );
            }

            logger.info(
              `[GAMES] TEST_CATEGORY filter active: Processing ${
                categories.length
              } of ${originalCount} categories (Filter: ID=${
                testCategoryId || "none"
              }, Name=${testCategoryName || "none"})`
            );
          }

          // Process each category sequentially
          logger.info(
            `[GAMES] Processing ${categories.length} categories sequentially`
          );

          for (let i = 0; i < categories.length; i++) {
            const [categoryKey, categoryData] = categories[i];

            // Process category
            const categoryResult = await this.processCategory(
              categoryKey,
              categoryData,
              i,
              categories.length
            );

            // MEMORY FIX: Assign fixtures immediately after scraping each category (streaming mode)
            // This prevents accumulation of thousands of fixtures in memory
            if (
              categoryResult.scrapedGameData &&
              categoryResult.scrapedGameData.length > 0
            ) {
              logger.info(
                `[GAMES] [COMPETITION-${i + 1}] Assigning ${
                  categoryResult.scrapedGameData.length
                } fixtures immediately (streaming mode)`
              );

              // Assign fixtures for this category immediately
              const assignmentBatchSize = parseInt(
                process.env.GAME_DATA_ASSIGNMENT_BATCH_SIZE || "10",
                10
              );
              const categoryAssignmentBatches = this.createBatches(
                categoryResult.scrapedGameData,
                assignmentBatchSize
              );

              for (const assignmentBatch of categoryAssignmentBatches) {
                let assignGameDataObj = new assignGameData(
                  assignmentBatch,
                  this.dataObj
                );
                await assignGameDataObj.setup();
                assignGameDataObj = null;

                // Force GC after every assignment batch
                if (global.gc) {
                  global.gc();
                }
              }

              // CRITICAL: Clear category scraped data immediately after assignment
              categoryResult.scrapedGameData.length = 0;
              categoryResult.scrapedGameData = null;
            }

            // Only track fixture IDs (minimal memory footprint)
            if (categoryResult.fixtureIds) {
              categoryResult.fixtureIds.forEach((gameID) => {
                if (!scrapedFixtureIds.has(gameID)) {
                  scrapedFixtureIds.add(gameID);
                  scrapedFixturesMinimal.push({ gameID });
                }
              });
            }

            // Cleanup between categories (except last one)
            if (i < categories.length - 1) {
              await this.cleanupBetweenCategories(i);
            }
          }

          // All fixtures have been assigned during category processing (streaming mode)
          // No need for separate assignment phase
        }
      }

      // STANDARD PROCESSING: Process all teams together (if category isolation not used or failed)
      if (!this.options.isolateByCategory) {
        logger.info("[GAMES] Using standard processing (all teams together)");

        // MEMORY FIX: Use smaller default batch sizes to reduce memory spikes
        const batchSize = parseInt(process.env.GAME_DATA_BATCH_SIZE || "3", 10);
        const teamBatches = this.createBatches(teams, batchSize);
        totalBatches = teamBatches.length; // Track for logging

        // MEMORY FIX: Reduce default concurrency to prevent memory spikes
        // Process batches sequentially by default (concurrency: 1) for better memory control
        batchConcurrency = parseInt(
          process.env.GAME_DATA_BATCH_CONCURRENCY || "1",
          10
        );
        logger.info(
          `[GAMES] Processing ${teamBatches.length} batches with concurrency: ${batchConcurrency} (batch size: ${batchSize})`
        );

        // OPTIMIZATION: Create page pool once before parallel batch processing
        // This prevents multiple batches from checking/creating the pool simultaneously
        const { PARALLEL_CONFIG } = require("../puppeteer/constants");
        const puppeteerManager =
          require("../puppeteer/PuppeteerManager").getInstance();
        const concurrency = PARALLEL_CONFIG.TEAMS_CONCURRENCY;
        if (puppeteerManager.pagePool.length === 0) {
          logger.info(
            `[GAMES] Creating page pool of size ${concurrency} before parallel batch processing`
          );
          await puppeteerManager.createPagePool(concurrency);
        }

        // Process batches in parallel
        const { results: batchResults, errors: standardBatchErrors } =
          await processInParallel(
            teamBatches.map((batch, index) => ({
              batch,
              batchNumber: index + 1,
            })),
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
                logger.warn(
                  `[GAMES] [BATCH-${batchNumber}] No game data scraped for current batch.`
                );
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
              logger.info(
                `[GAMES] [BATCH-${batchNumber}] ===== SCRAPED DATA BEFORE CMS =====`,
                {
                  accountId: this.dataObj.ACCOUNT.ACCOUNTID,
                  batchNumber,
                  scrapedCount: scrapedGameData ? scrapedGameData.length : 0,
                  isArray: Array.isArray(scrapedGameData),
                  dataType: scrapedGameData
                    ? typeof scrapedGameData
                    : "null/undefined",
                }
              );

              if (scrapedGameData && Array.isArray(scrapedGameData)) {
                logger.info(
                  `[GAMES] [BATCH-${batchNumber}] ===== SCRAPED ${scrapedGameData.length} FIXTURES =====`
                );

                // Log summary for this batch
                const uniqueGrades = [
                  ...new Set(scrapedGameData.flatMap((f) => f?.grade || [])),
                ];
                const uniqueStatuses = [
                  ...new Set(
                    scrapedGameData.map((f) => f?.status || "Unknown")
                  ),
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
                logger.warn(
                  `[GAMES] [BATCH-${batchNumber}] Scraped data is not an array:`,
                  {
                    data: scrapedGameData,
                    type: typeof scrapedGameData,
                  }
                );
              }
              logger.info(
                `[GAMES] [BATCH-${batchNumber}] ===== END SCRAPED DATA LOG =====`
              );

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

        // MEMORY FIX: Assign fixtures immediately after each batch (streaming mode)
        // This prevents accumulation of thousands of fixtures in memory
        const assignmentBatchSize = parseInt(
          process.env.GAME_DATA_ASSIGNMENT_BATCH_SIZE || "10",
          10
        );

        let batchIndex = 0;

        // Process batches and assign immediately (streaming mode)
        for (const batchResult of batchResults) {
          batchIndex++;
          if (
            batchResult &&
            batchResult.scrapedGameData &&
            batchResult.scrapedGameData.length > 0
          ) {
            // Assign fixtures for this batch immediately
            const batchAssignmentBatches = this.createBatches(
              batchResult.scrapedGameData,
              assignmentBatchSize
            );

            for (const assignmentBatch of batchAssignmentBatches) {
              let assignGameDataObj = new assignGameData(
                assignmentBatch,
                this.dataObj
              );
              await assignGameDataObj.setup();
              assignGameDataObj = null;

              // Force GC after every assignment batch
              if (global.gc) {
                global.gc();
              }
            }

            // CRITICAL: Clear batch scraped data immediately after assignment
            batchResult.scrapedGameData.length = 0;
            batchResult.scrapedGameData = null;

            // Track fixture IDs only (minimal memory footprint)
            if (batchResult.fixtureIds) {
              batchResult.fixtureIds.forEach((gameID) => {
                if (!scrapedFixtureIds.has(gameID)) {
                  scrapedFixtureIds.add(gameID);
                  scrapedFixturesMinimal.push({ gameID });
                }
              });
            }

            // MEMORY FIX: Cleanup page pool and force GC every 5 batches
            if (batchIndex % 5 === 0) {
              logger.info(
                `[GAMES] [BATCH-${batchIndex}] Memory cleanup: Cleaning page pool and forcing GC`
              );
              await puppeteerManager.cleanupOrphanedPages();
              if (global.gc) {
                global.gc();
              }
            }
          }
        }

        // Update batchErrors with standard processing errors
        batchErrors = standardBatchErrors;
      }

      // Log batch processing errors if any
      if (batchErrors && batchErrors.length > 0) {
        logger.warn(
          `[GAMES] ${batchErrors.length} batches failed during scraping`,
          {
            errors: batchErrors.map((e) => e.message),
          }
        );
      }

      // All fixtures have been assigned during batch processing (streaming mode)
      // No need for separate assignment phase

      // Log summary - handle both processing paths
      if (totalBatches > 0) {
        logger.info(
          `[GAMES] Scraped ${scrapedFixtureIds.size} unique fixtures total across ${totalBatches} batches (processed ${batchConcurrency} batches in parallel)`
        );
      } else {
        logger.info(
          `[GAMES] Scraped ${scrapedFixtureIds.size} unique fixtures total (category isolation mode)`
        );
      }

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
