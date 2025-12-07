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
        // NORMAL MODE: Process all teams directly in parallel (no batching)
        // Date filtering will prevent old/future fixtures from being processed
        logger.info(
          `[GAMES] [COMPETITION-${categoryIndex + 1}] Processing all ${
            teams.length
          } teams directly in parallel (no batching)`
        );

        // Process all teams as a single "batch" - they'll be processed in parallel internally
        teamBatches = [teams];
        batchConcurrency = 1; // Only 1 "batch" (all teams), but teams process in parallel
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
            logger.info(
              `[GAMES] [COMPETITION-${categoryIndex + 1}] Processing ${
                batch.length
              } teams directly in parallel`
            );

            // PERFORMANCE FIX: Disable per-team assignment by default (causes massive slowdown)
            // Per-team assignment makes sequential API calls for each team, blocking parallel processing
            const assignPerTeam = process.env.GAMES_ASSIGN_PER_TEAM === "true"; // Default: disabled for performance

            logger.info(
              `[GAMES] [COMPETITION-${
                categoryIndex + 1
              }] Calling getGameData.setup() with ${batch.length} teams`
            );

            let getGameDataObj = new getTeamsGameData(
              {
                ACCOUNT: this.dataObj.ACCOUNT,
                TEAMS: batch,
                // Include full dataObj for assignment if per-team assignment enabled
                ...(assignPerTeam ? this.dataObj : {}),
              },
              {
                assignPerTeam: assignPerTeam,
              }
            );
            let scrapedGameData = await getGameDataObj.setup();
            getGameDataObj = null;

            if (!scrapedGameData || scrapedGameData.length === 0) {
              return { batchNumber, scrapedGameData: [], fixtureIds: [] };
            }

            // If per-team assignment was used, scrapedGameData is already minimal objects { gameID }
            const batchFixtureIds = [];
            scrapedGameData.forEach((fixture) => {
              const gameID = fixture?.gameID || fixture;
              if (gameID) {
                batchFixtureIds.push(gameID);
              }
            });

            return {
              batchNumber,
              scrapedGameData: assignPerTeam
                ? scrapedGameData // Already minimal objects { gameID }
                : scrapedGameData, // Full fixture objects
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

      // MEMORY OPTIMIZATION: Auto-detect large associations and adjust processing strategy
      // Threshold: 100 teams (most associations are smaller, but some can have 100-300 teams)
      const largeAssociationThreshold = parseInt(
        process.env.GAMES_LARGE_ASSOCIATION_THRESHOLD || "100",
        10
      );
      const isLargeAssociation = teams.length > largeAssociationThreshold;
      const autoCategoryIsolation =
        process.env.GAMES_AUTO_CATEGORY_ISOLATION === "true" ||
        process.env.GAMES_AUTO_CATEGORY_ISOLATION !== "false"; // Default: true

      if (isLargeAssociation) {
        logger.warn(
          `[GAMES] ⚠️ LARGE ASSOCIATION DETECTED: ${teams.length} teams (threshold: ${largeAssociationThreshold})`
        );

        // Auto-enable category isolation for large associations if not already enabled
        if (autoCategoryIsolation && !this.options.isolateByCategory) {
          logger.info(
            `[GAMES] 🔄 Auto-enabling category isolation for large association (${teams.length} teams)`
          );
          this.options.isolateByCategory = true;
        }
      }

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
              const totalFixturesFromResponse =
                categoryResult.scrapedGameData.length;

              logger.info(
                `[FIXTURE-FILTER] [GAMES] [COMPETITION-${
                  i + 1
                }] Total fixtures returned from response: ${totalFixturesFromResponse}`
              );

              // Assign fixtures for this category immediately
              // MEMORY OPTIMIZATION: Use smaller assignment batches (default: 5, or 1 for large categories)
              const isLargeCategory =
                categoryResult.scrapedGameData.length > 100;
              const defaultAssignmentBatchSize = isLargeCategory ? 1 : 5;
              const assignmentBatchSize = parseInt(
                process.env.GAME_DATA_ASSIGNMENT_BATCH_SIZE ||
                  defaultAssignmentBatchSize.toString(),
                10
              );
              // Filter out fixtures older than 2 weeks before creating assignment batches
              // COMMENTED OUT: Date filtering temporarily disabled
              // const filteredScrapedGameData = this.filterOldFixtures(
              //   categoryResult.scrapedGameData
              // );
              const filteredScrapedGameData = categoryResult.scrapedGameData; // Use unfiltered data

              logger.info(
                `[FIXTURE-FILTER] [GAMES] [COMPETITION-${
                  i + 1
                }] Fixtures summary: ${totalFixturesFromResponse} returned from response, ${
                  filteredScrapedGameData.length
                } remaining to upload to CMS (filtering disabled)`
              );

              if (filteredScrapedGameData.length === 0) {
                logger.info(
                  `[FIXTURE-FILTER] [GAMES] [COMPETITION-${
                    i + 1
                  }] No fixtures to assign after filtering (all were filtered out by date range)`
                );
                // Clear the original data
                categoryResult.scrapedGameData.length = 0;
                categoryResult.scrapedGameData = null;
                continue;
              }

              const categoryAssignmentBatches = this.createBatches(
                filteredScrapedGameData,
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
        logger.info(
          `[GAMES] Processing all ${teams.length} teams directly in parallel (no batching)`
        );

        // Process all teams as a single "batch" - they'll be processed in parallel internally
        const teamBatches = [teams];
        totalBatches = 1; // Only 1 "batch" (all teams)
        batchConcurrency = 1; // Only 1 "batch", but teams process in parallel

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
                `[GAMES] Processing ${batch.length} teams directly in parallel`
              );

              // Scrape game data for the current batch
              // PERFORMANCE FIX: Disable per-team assignment by default (causes massive slowdown)
              // Per-team assignment makes sequential API calls for each team, blocking parallel processing
              const assignPerTeam =
                process.env.GAMES_ASSIGN_PER_TEAM === "true"; // Default: disabled for performance

              let getGameDataObj = new getTeamsGameData(
                {
                  ACCOUNT: this.dataObj.ACCOUNT,
                  TEAMS: batch,
                  // Include full dataObj for assignment if per-team assignment enabled
                  ...(assignPerTeam ? this.dataObj : {}),
                },
                {
                  assignPerTeam: assignPerTeam,
                }
              );
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

        // PERFORMANCE FIX: Check if per-team assignment was used (disabled by default)
        const assignPerTeam = process.env.GAMES_ASSIGN_PER_TEAM === "true"; // Default: disabled for performance
        let batchIndex = 0;

        if (assignPerTeam) {
          // Per-team assignment already happened - fixtures are already assigned to CMS
          // No need to accumulate or process further, just cleanup
          logger.info(
            "[GAMES] Per-team assignment enabled - all fixtures already assigned to CMS"
          );

          for (const batchResult of batchResults) {
            batchIndex++;
            // Clear any remaining references
            if (batchResult && batchResult.scrapedGameData) {
              batchResult.scrapedGameData.length = 0;
              batchResult.scrapedGameData = null;
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
        } else {
          // MEMORY FIX: Assign fixtures immediately after each batch (streaming mode)
          // This prevents accumulation of thousands of fixtures in memory
          // MEMORY OPTIMIZATION: Use smaller assignment batches (default: 5, or 1 for large associations)
          const defaultAssignmentBatchSize = isLargeAssociation ? 1 : 5;
          const assignmentBatchSize = parseInt(
            process.env.GAME_DATA_ASSIGNMENT_BATCH_SIZE ||
              defaultAssignmentBatchSize.toString(),
            10
          );

          // Process batches and assign immediately (streaming mode)
          for (const batchResult of batchResults) {
            batchIndex++;
            if (
              batchResult &&
              batchResult.scrapedGameData &&
              batchResult.scrapedGameData.length > 0
            ) {
              const totalFixturesFromResponse =
                batchResult.scrapedGameData.length;

              logger.info(
                `[FIXTURE-FILTER] [GAMES] [BATCH-${batchIndex}] Total fixtures returned from response: ${totalFixturesFromResponse}`
              );

              // Filter out fixtures older than 2 weeks before creating assignment batches
              // COMMENTED OUT: Date filtering temporarily disabled
              // const filteredBatchGameData = this.filterOldFixtures(
              //   batchResult.scrapedGameData
              // );
              const filteredBatchGameData = batchResult.scrapedGameData; // Use unfiltered data

              logger.info(
                `[FIXTURE-FILTER] [GAMES] [BATCH-${batchIndex}] Fixtures summary: ${totalFixturesFromResponse} returned from response, ${filteredBatchGameData.length} remaining to upload to CMS (filtering disabled)`
              );

              if (filteredBatchGameData.length === 0) {
                logger.info(
                  `[FIXTURE-FILTER] [GAMES] [BATCH-${batchIndex}] No fixtures to assign after filtering (all were filtered out by date range)`
                );
                // Clear the original data
                batchResult.scrapedGameData.length = 0;
                batchResult.scrapedGameData = null;
                continue;
              }

              // Assign fixtures for this batch immediately
              const batchAssignmentBatches = this.createBatches(
                filteredBatchGameData,
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

  /**
   * Filter out fixtures that are more than 2 weeks old OR more than 4 weeks in the future
   * @param {Array} gameData - Array of fixture objects with dayOne property
   * @returns {Array} Filtered array containing only fixtures within date range (2 weeks past to 4 weeks future)
   */
  filterOldFixtures(gameData) {
    if (!gameData || gameData.length === 0) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14); // 2 weeks ago

    const fourWeeksFromNow = new Date(today);
    fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 30); // 30 days (4 weeks) in the future
    fourWeeksFromNow.setHours(23, 59, 59, 999); // End of day

    let filteredOutPast = 0;
    let filteredOutFuture = 0;
    let filteredOutInvalid = 0;

    const filtered = gameData.filter((fixture) => {
      // Skip if dayOne is missing or invalid
      if (!fixture.dayOne || !(fixture.dayOne instanceof Date)) {
        filteredOutInvalid++;
        return false;
      }

      // Filter out fixtures older than 2 weeks
      if (fixture.dayOne < twoWeeksAgo) {
        filteredOutPast++;
        return false;
      }

      // Filter out fixtures more than 4 weeks in the future
      if (fixture.dayOne > fourWeeksFromNow) {
        filteredOutFuture++;
        return false;
      }

      // Keep fixtures within the date range
      return true;
    });

    const totalFiltered =
      filteredOutPast + filteredOutFuture + filteredOutInvalid;
    if (totalFiltered > 0) {
      const parts = [];
      if (filteredOutPast > 0) {
        parts.push(`${filteredOutPast} older than 2 weeks`);
      }
      if (filteredOutFuture > 0) {
        parts.push(`${filteredOutFuture} more than 4 weeks in future`);
      }
      if (filteredOutInvalid > 0) {
        parts.push(`${filteredOutInvalid} with invalid/missing date`);
      }
      logger.info(
        `[FIXTURE-FILTER] [GAMES] Filtered out ${totalFiltered} fixture(s): ${parts.join(
          ", "
        )} (from ${gameData.length} total)`
      );
    }

    return filtered;
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
