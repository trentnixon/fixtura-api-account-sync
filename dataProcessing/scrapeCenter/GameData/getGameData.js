const logger = require("../../../src/utils/logger");
const GameDataFetcher = require("./GameDataFetcher");
const ProcessingTracker = require("../../services/processingTracker");
const PuppeteerManager = require("../../puppeteer/PuppeteerManager");
const { processInParallel } = require("../../utils/parallelUtils");
const { PARALLEL_CONFIG } = require("../../puppeteer/constants");
const AssignGameData = require("../../assignCenter/assignGameData");

class GetTeamsGameData {
  constructor(dataObj, options = {}) {
    this.teams = dataObj.TEAMS;
    this.accountId = dataObj.ACCOUNT.ACCOUNTID;
    this.accountType = dataObj.ACCOUNT.ACCOUNTTYPE;
    this.dataObj = dataObj; // Store for assignment
    // Use singleton to share browser instance across services (memory optimization)
    this.puppeteerManager = PuppeteerManager.getInstance();
    this.processingTracker = ProcessingTracker.getInstance();
    this.domain = "https://www.playhq.com";
    // PERFORMANCE FIX: Disable per-team assignment by default (causes massive slowdown)
    // Per-team assignment makes sequential API calls for each team, blocking parallel processing
    // Only enable if explicitly requested via options or environment variable
    this.assignPerTeam =
      options.assignPerTeam === true ||
      process.env.GAMES_ASSIGN_PER_TEAM === "true";
  }

  // Initialize Puppeteer and get a reusable page (Strategy 2: Page Reuse)
  async initPage() {
    return await this.puppeteerManager.getReusablePage();
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

  /**
   * Assign fixtures immediately after scraping (per-team assignment)
   * This prevents fixture accumulation in memory
   */
  async assignFixturesImmediately(gameData) {
    if (!gameData || gameData.length === 0) {
      return;
    }

    const totalFixturesFromResponse = gameData.length;

    // Filter out fixtures older than 2 weeks before assignment
    const filteredGameData = this.filterOldFixtures(gameData);

    logger.info(
      `[FIXTURE-FILTER] [GAMES] Fixtures summary: ${totalFixturesFromResponse} returned from response, ${filteredGameData.length} remaining to upload to CMS`
    );

    if (filteredGameData.length === 0) {
      logger.info(
        `[FIXTURE-FILTER] [GAMES] No fixtures to assign after filtering (all were filtered out by date range)`
      );
      return;
    }

    try {
      let assignGameDataObj = new AssignGameData(
        filteredGameData,
        this.dataObj,
        filteredGameData.length
      );
      await assignGameDataObj.setup();
      assignGameDataObj = null;

      // Force GC after assignment
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      logger.error(`Error assigning fixtures immediately: ${error.message}`, {
        error: error.message,
        fixtureCount: gameData.length,
        stack: error.stack,
      });
      // Don't throw - allow processing to continue
    }
  }

  // Process teams in parallel using page pool (Strategy 1: Parallel Page Processing)
  async processGamesBatch(teamsBatch) {
    if (!teamsBatch || teamsBatch.length === 0) {
      logger.info("No teams to process in batch");
      return [];
    }

    // MEMORY OPTIMIZATION: Allow parallel processing even with per-team assignment
    // Use streaming results to prevent accumulation while maintaining concurrency
    const concurrency = PARALLEL_CONFIG.TEAMS_CONCURRENCY;

    logger.info(`[PARALLEL_GAMES] ========================================`);
    logger.info(
      `[PARALLEL_GAMES] Processing ${teamsBatch.length} teams in parallel`
    );
    logger.info(`[PARALLEL_GAMES] Concurrency: ${concurrency}`);
    logger.info(
      `[PARALLEL_GAMES] Per-team assignment: ${
        this.assignPerTeam ? "ENABLED" : "DISABLED"
      }`
    );
    logger.info(`[PARALLEL_GAMES] ========================================`);

    // CRITICAL: Create page pool BEFORE parallel processing starts
    // This ensures all pages are ready and we get true parallel processing
    const currentPoolSize = this.puppeteerManager.pagePool.length;
    logger.info(
      `[PARALLEL_GAMES] Current page pool size: ${currentPoolSize}, required concurrency: ${concurrency}, teams in batch: ${teamsBatch.length}`
    );

    if (currentPoolSize < concurrency) {
      const neededPages = concurrency - currentPoolSize;
      logger.info(
        `[PARALLEL_GAMES] Page pool too small (${currentPoolSize} < ${concurrency}), creating ${neededPages} additional pages`
      );
      await this.puppeteerManager.createPagePool(concurrency);
    } else {
      logger.info(
        `[PARALLEL_GAMES] Page pool sufficient (${currentPoolSize} >= ${concurrency}), proceeding with parallel processing`
      );
    }

    // Process teams in parallel
    // MEMORY OPTIMIZATION: Use streaming results when per-team assignment is enabled
    // This prevents accumulation of fixture IDs in memory while maintaining concurrency
    const { results, errors, summary } = await processInParallel(
      teamsBatch,
      async (team, index) => {
        const taskStartTime = Date.now();
        // Get a page from the pool for this team
        const page = await this.puppeteerManager.getPageFromPool();
        const pageAcquiredTime = Date.now();

        try {
          const { teamName, id, href, grade } = team;
          const url = `${this.domain}${href}`;

          // CRITICAL: Log the URL being used to verify each team gets its own URL
          logger.info(
            `[PARALLEL_GAMES] [TASK-${
              index + 1
            }] START team: ${teamName} (ID: ${id}) | URL: ${url} | Page URL before: ${page.url()} (page acquired: ${
              pageAcquiredTime - taskStartTime
            }ms)`
          );

          // CRITICAL: Verify page is at about:blank before navigation
          const pageUrlBeforeNav = page.url();
          if (
            pageUrlBeforeNav !== "about:blank" &&
            pageUrlBeforeNav !== "chrome-error://chromewebdata/"
          ) {
            logger.warn(
              `[PARALLEL_GAMES] [TASK-${
                index + 1
              }] Page not reset! Expected about:blank, got: ${pageUrlBeforeNav}`
            );
            // Force reset the page
            try {
              await page.goto("about:blank", {
                waitUntil: "domcontentloaded",
                timeout: 5000,
              });
            } catch (resetError) {
              logger.error(
                `[PARALLEL_GAMES] [TASK-${index + 1}] Failed to reset page: ${
                  resetError.message
                }`
              );
            }
          }

          const gameDataFetcher = new GameDataFetcher(page, url, grade);
          const gameData = await gameDataFetcher.fetchGameData();

          // CRITICAL: Verify the page actually navigated to the correct URL
          const pageUrlAfter = page.url();
          if (
            pageUrlAfter !== url &&
            !pageUrlAfter.includes(url.split("?")[0])
          ) {
            logger.error(
              `[PARALLEL_GAMES] [TASK-${
                index + 1
              }] URL MISMATCH! Expected: ${url}, Actual page URL: ${pageUrlAfter}`
            );
            // This is a critical error - the wrong page was used
            throw new Error(
              `Page URL mismatch: expected ${url} but got ${pageUrlAfter}. This indicates a page reuse race condition.`
            );
          }

          const taskDuration = Date.now() - taskStartTime;
          const filteredGameData =
            gameData?.filter((match) => match !== null) || [];
          const gameCount = filteredGameData.length;

          logger.info(
            `[PARALLEL_GAMES] [TASK-${
              index + 1
            }] COMPLETE team: ${teamName} (duration: ${taskDuration}ms, games: ${gameCount})`
          );

          // MEMORY OPTIMIZATION: Assign fixtures immediately after scraping this team
          if (this.assignPerTeam && filteredGameData.length > 0) {
            logger.info(
              `[FIXTURE-FILTER] [PARALLEL_GAMES] [TASK-${
                index + 1
              }] Total fixtures returned from response: ${gameCount}`
            );

            // Extract fixture IDs before assignment (for tracking)
            const fixtureIds = filteredGameData
              .map((fixture) => fixture?.gameID)
              .filter((id) => id);

            // Assign fixtures immediately (this will filter by date range)
            await this.assignFixturesImmediately(filteredGameData);

            // Clear gameData immediately after assignment
            filteredGameData.length = 0;

            // Return only IDs for tracking (minimal memory footprint)
            return fixtureIds;
          }

          // Filter null results (gameData is already flat from parallel processing)
          return filteredGameData;
        } catch (error) {
          logger.error(`Error processing team game data: ${team.teamName}`, {
            error: error.message,
            teamId: team.id,
            index,
          });
          throw error; // Re-throw to be caught by processInParallel
        } finally {
          // Release page back to pool after processing
          await this.puppeteerManager.releasePageFromPool(page);
        }
      },
      concurrency, // CRITICAL: Pass concurrency to processInParallel
      {
        context: "teams_game_data",
        logProgress: true,
        continueOnError: true,
        // MEMORY OPTIMIZATION: Stream results when per-team assignment enabled
        // This prevents accumulation of fixture IDs in the results array
        streamResults: this.assignPerTeam,
        onResult: this.assignPerTeam
          ? async (result, index, item) => {
              // Results are already processed (assigned) in the processor function
              // This callback is just for streaming - no additional processing needed
              // The result is already minimal (fixture IDs only)
            }
          : undefined,
      }
    );

    logger.info(
      `[PARALLEL_GAMES] Parallel processing complete: ${summary.successful}/${teamsBatch.length} successful, concurrency used: ${concurrency}`
    );

    // Log summary
    logger.info(
      `Teams game data processing completed: ${summary.successful}/${teamsBatch.length} successful, ${summary.failed} failed, ${summary.duration}ms`
    );

    if (errors.length > 0) {
      logger.warn(`Failed to fetch game data for ${errors.length} teams`, {
        errors: errors.map((e) => ({
          teamName: e.item?.teamName,
          teamId: e.item?.id,
          error: e.error,
        })),
      });
    }

    // MEMORY OPTIMIZATION: If per-team assignment enabled, fixtures are already assigned
    // We don't need to accumulate fixture IDs - just return minimal tracking
    if (this.assignPerTeam) {
      // Results are arrays of fixture IDs (strings), but we don't need to accumulate them
      // Just count them for tracking and return empty/minimal array
      const totalFixtureIds = results
        .flat()
        .filter((id) => id && typeof id === "string").length;

      logger.info(
        `[PER-TEAM ASSIGNMENT] Processed ${totalFixtureIds} fixtures across ${teamsBatch.length} teams (already assigned)`
      );

      // MEMORY FIX: Clear intermediate arrays immediately after use
      results.length = 0;
      errors.length = 0;

      // Return empty array - fixtures already assigned, no need to track IDs
      // This prevents accumulation of thousands of fixture IDs in memory
      return [];
    }

    // OPTIMIZATION: Results are already flat from parallel processing
    // No need to flatten again - just filter and return
    const allResults = results.flat(); // Flatten once (results is array of arrays from parallel processing)

    // MEMORY FIX: Clear intermediate arrays immediately after use
    results.length = 0; // Clear results array
    errors.length = 0; // Clear errors array (already logged)

    return allResults;
  }

  async fetchAndProcessTeamGameData(page, url) {
    try {
      const gameDataFetcher = new GameDataFetcher(page, url);
      return await gameDataFetcher.fetchGameData();
    } catch (error) {
      logger.error("Error fetching game data, returning empty array", {
        error: error.message,
        url,
      });
      // Return empty array instead of throwing - allows processing to continue
      return [];
    }
  }

  async setup() {
    try {
      logger.info(
        `[PARALLEL_GAMES] [SETUP] Starting setup with ${
          this.teams?.length || 0
        } teams`
      );
      // Process teams in parallel using page pool (no need for single page anymore)
      let fetchedGames = await this.processGamesBatch(this.teams);

      fetchedGames = this.removeDuplicateGames(fetchedGames);
      if (fetchedGames.length === 0) {
        logger.warn("No game data found for team batch", {
          teamsCount: this.teams?.length || 0,
        });
      }
      this.processingTracker.itemFound("games", fetchedGames.length);
      return fetchedGames;
    } catch (error) {
      logger.error("Error in setup method, returning empty array", {
        error: error.message,
        accountId: this.accountId,
      });
      // Return empty array instead of throwing - allows processing to continue
      return [];
    }
    // No finally block needed - pages are released in processGamesBatch()
  }

  removeDuplicateGames(games) {
    return [...new Map(games.map((game) => [game.gameID, game])).values()];
  }
}

module.exports = GetTeamsGameData;

// Developer Notes:
// - This class uses Puppeteer to navigate and scrape game data from web pages.
// - Ensure that the GameDataFetcher is properly implemented to extract relevant game details.
// - removeDuplicateGames method prevents processing of duplicate game entries.

// Future Improvements:
// - Optimize Puppeteer usage for performance.
// - Enhance error handling to include retry mechanisms.
// - Investigate dynamic content handling on game data pages.
