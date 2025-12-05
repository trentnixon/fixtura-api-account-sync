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
    // MEMORY OPTIMIZATION: Enable per-team assignment to prevent accumulation
    this.assignPerTeam =
      options.assignPerTeam || process.env.GAMES_ASSIGN_PER_TEAM === "true";
  }

  // Initialize Puppeteer and get a reusable page (Strategy 2: Page Reuse)
  async initPage() {
    return await this.puppeteerManager.getReusablePage();
  }

  /**
   * Assign fixtures immediately after scraping (per-team assignment)
   * This prevents fixture accumulation in memory
   */
  async assignFixturesImmediately(gameData) {
    if (!gameData || gameData.length === 0) {
      return;
    }

    try {
      let assignGameDataObj = new AssignGameData(
        gameData,
        this.dataObj,
        gameData.length
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

    const concurrency = PARALLEL_CONFIG.TEAMS_CONCURRENCY;
    logger.info(
      `Processing ${
        teamsBatch.length
      } teams in parallel (concurrency: ${concurrency})${
        this.assignPerTeam ? " [PER-TEAM ASSIGNMENT ENABLED]" : ""
      }`
    );

    // CRITICAL: Create page pool BEFORE parallel processing starts
    // This ensures all pages are ready and we get true parallel processing
    if (this.puppeteerManager.pagePool.length === 0) {
      logger.info(
        `Creating page pool of size ${concurrency} before parallel processing`
      );
      await this.puppeteerManager.createPagePool(concurrency);
    }

    // Process teams in parallel
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

          logger.info(
            `[PARALLEL_GAMES] [TASK-${
              index + 1
            }] START team: ${teamName} (ID: ${id}) (page acquired: ${
              pageAcquiredTime - taskStartTime
            }ms)`
          );

          const gameDataFetcher = new GameDataFetcher(page, url, grade);
          const gameData = await gameDataFetcher.fetchGameData();

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
              `[PARALLEL_GAMES] [TASK-${
                index + 1
              }] Assigning ${gameCount} fixtures immediately (per-team assignment)`
            );

            // Extract fixture IDs before assignment (for tracking)
            const fixtureIds = filteredGameData
              .map((fixture) => fixture?.gameID)
              .filter((id) => id);

            // Assign fixtures immediately
            await this.assignFixturesImmediately(filteredGameData);

            // Clear gameData immediately after assignment
            filteredGameData.length = 0;

            // Return only IDs for tracking
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
      concurrency,
      {
        context: "teams_game_data",
        logProgress: true,
        continueOnError: true,
      }
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

    // MEMORY OPTIMIZATION: If per-team assignment enabled, results are already IDs only
    if (this.assignPerTeam) {
      // Results are arrays of fixture IDs (strings), flatten and return minimal objects
      const allFixtureIds = results
        .flat()
        .filter((id) => id && typeof id === "string");

      // MEMORY FIX: Clear intermediate arrays immediately after use
      results.length = 0;
      errors.length = 0;

      // Return minimal objects { gameID } for tracking
      return allFixtureIds.map((gameID) => ({ gameID }));
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
