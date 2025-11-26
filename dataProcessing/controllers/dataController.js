const DataService = require("../services/dataService");
const MemoryTracker = require("../utils/memoryTracker");
const CompetitionProcessor = require("../processors/competitionProcessor");
const TeamProcessor = require("../processors/teamProcessor");
const GameDataProcessor = require("../processors/gameDataProcessor");
const FixtureValidationProcessor = require("../processors/fixtureValidationProcessor");
const FixtureComparisonService = require("../services/fixtureComparisonService");
const FixtureDeletionService = require("../services/fixtureDeletionService");
const CRUDOperations = require("../services/CRUDoperations");
const ProcessingTracker = require("../services/processingTracker");
const GameCRUD = require("../assignCenter/games/GameCrud");

const errorHandler = require("../utils/errorHandler");
const logger = require("../../src/utils/logger");
const PuppeteerManager = require("../puppeteer/PuppeteerManager");

class DataController {
  constructor(fromRedis) {
    this.fromRedis = fromRedis;
    this.dataService = new DataService();
    this.memoryTracker = new MemoryTracker();
    this.CRUDOperations = new CRUDOperations();
    this.fixtureValidationResults = []; // Store validation results for cleanup phase
    this.scrapedFixtures = []; // Store scraped fixtures from ProcessGames for comparison
    this.fetchedFixtures = []; // Store fetched fixtures from ProcessFixtureValidation
    if (!ProcessingTracker.instance) {
      new ProcessingTracker();
    }
    this.processingTracker = ProcessingTracker.getInstance();
  }

  /**
   * Force browser restart between processing stages to prevent memory accumulation
   * This helps prevent memory spikes in single-job executions
   */
  async forceBrowserRestartIfNeeded() {
    try {
      const puppeteerManager = PuppeteerManager.getInstance();
      if (puppeteerManager && puppeteerManager.browser) {
        logger.info(
          "[MEMORY] Forcing browser restart between processing stages"
        );
        await puppeteerManager.forceRestartBrowser();
        logger.info("[MEMORY] Browser restart completed between stages");
      }
    } catch (error) {
      logger.warn("[MEMORY] Error forcing browser restart between stages", {
        error: error.message,
      });
      // Don't throw - browser restart is optional optimization
    }
  }

  async reSyncData() {
    return await this.dataService.fetchData(this.fromRedis);
  }

  /**
   * Re-sync data using direct org ID (bypasses account lookup).
   * Used for direct club/association ID processing.
   *
   * @param {number} orgId - The organization ID (club or association ID)
   * @param {string} orgType - The organization type ("CLUB" or "ASSOCIATION")
   * @returns {Promise<object>} - Structured data object with pseudo account ID
   */
  async reSyncDataDirect(orgId, orgType) {
    return await this.dataService.fetchDataDirect(orgId, orgType);
  }

  /**
   * Update account data only - fetches fresh account data without processing competitions, teams, or games.
   * This is used for on-demand account updates that only refresh account metadata.
   */
  async updateAccountOnly() {
    try {
      // Fetch fresh account data from CMS
      const dataObj = await this.reSyncData();

      logger.info(
        `Account data fetched successfully for account ${dataObj.ACCOUNT.ACCOUNTID} (${dataObj.ACCOUNT.ACCOUNTTYPE})`
      );

      // Return success without processing competitions, teams, or games
      return { Complete: true, accountId: dataObj.ACCOUNT.ACCOUNTID };
    } catch (error) {
      errorHandler.handle(error, "DataController");
      logger.error("Error in updateAccountOnly:", {
        accountId: this.fromRedis?.ID,
        error: error.message,
      });
      return { Complete: false };
    }
  }

  async start() {
    try {
      this.memoryTracker.startTracking();
      const startTime = new Date();

      // Fetch data
      let dataObj = await this.reSyncData();

      // Create a data collection entry
      const collectionID = await this.dataService.initCreateDataCollection(
        dataObj.ACCOUNT.ACCOUNTID
      );
      await this.processingTracker.updateDatabaseAfterAction(collectionID);

      // ========================================
      // [STAGE] PROCESS COMPETITIONS
      // ========================================
      logger.info("[STAGE] Starting competitions stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.setCurrentStage(
        "competitions",
        collectionID
      );
      logger.info("[STAGE] setCurrentStage('competitions') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await this.ProcessCompetitions(dataObj);
      await this.processingTracker.completeStage("competitions", collectionID);
      logger.info("[STAGE] completeStage('competitions') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // MEMORY OPTIMIZATION: Force browser restart between stages to free memory
      await this.forceBrowserRestartIfNeeded();

      logger.info("[START] Refreshing data after competitions", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      dataObj = await this.reSyncData();
      logger.info("[START] Data refreshed successfully after competitions", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // ========================================
      // [STAGE] PROCESS TEAMS
      // ========================================
      logger.info("[STAGE] Starting teams stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.setCurrentStage("teams", collectionID);
      logger.info("[STAGE] setCurrentStage('teams') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await this.ProcessTeams(dataObj);
      await this.processingTracker.completeStage("teams", collectionID);
      logger.info("[STAGE] completeStage('teams') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // MEMORY OPTIMIZATION: Force browser restart between stages to free memory
      await this.forceBrowserRestartIfNeeded();

      logger.info("[START] Refreshing data after teams", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      dataObj = await this.reSyncData();
      logger.info("[START] Data refreshed successfully after teams", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // ========================================
      // [STAGE] PROCESS GAMES
      // ========================================
      logger.info("[STAGE] Starting games stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.setCurrentStage("games", collectionID);
      logger.info("[STAGE] setCurrentStage('games') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[GAMES] Calling ProcessGames", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await this.ProcessGames(dataObj);
      logger.info("[GAMES] ProcessGames returned successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedFixturesCount: (this.scrapedFixtures || []).length,
      });
      await this.processingTracker.completeStage("games", collectionID);
      logger.info("[STAGE] completeStage('games') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // MEMORY OPTIMIZATION: Force browser restart between stages to free memory
      await this.forceBrowserRestartIfNeeded();

      logger.info("[START] Refreshing data after games", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      dataObj = await this.reSyncData();
      logger.info("[START] Data refreshed successfully after games", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // ========================================
      // [STAGE] PROCESS FIXTURE VALIDATION
      // ========================================
      logger.info("[STAGE] Starting fixture-validation stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.setCurrentStage(
        "fixture-validation",
        collectionID
      );
      logger.info("[STAGE] setCurrentStage('fixture-validation') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[VALIDATION] Calling ProcessFixtureValidation", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await this.ProcessFixtureValidation(dataObj);
      logger.info(
        "[VALIDATION] ProcessFixtureValidation returned successfully",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );

      logger.info("[STAGE] Completing fixture-validation stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.completeStage(
        "fixture-validation",
        collectionID
      );
      logger.info("[STAGE] completeStage('fixture-validation') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // ========================================
      // [STAGE] PROCESS FIXTURE CLEANUP
      // ========================================
      logger.info("[STAGE] Starting fixture-cleanup stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.setCurrentStage(
        "fixture-cleanup",
        collectionID
      );
      logger.info("[STAGE] setCurrentStage('fixture-cleanup') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[CLEANUP] Calling ProcessFixtureCleanup", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await this.ProcessFixtureCleanup(dataObj);
      logger.info("[CLEANUP] ProcessFixtureCleanup returned successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[STAGE] Completing fixture-cleanup stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.processingTracker.completeStage(
        "fixture-cleanup",
        collectionID
      );
      logger.info("[STAGE] completeStage('fixture-cleanup') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // ========================================
      // [TRACKING] PROCESS TRACKING
      // ========================================
      logger.info("[TRACKING] Starting ProcessTracking", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await this.ProcessTracking(startTime, collectionID);
      logger.info("[TRACKING] ProcessTracking completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      logger.info("[COMPLETE] DataController.start() completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });

      return { Complete: true };
    } catch (error) {
      errorHandler.handle(error, "DataController");
      logger.error("[ERROR] DataController.start() failed", {
        error: error.message,
        stack: error.stack,
      });
      return { Complete: false };
    } finally {
      logger.info("[CLEANUP] Starting DataController cleanup (finally block)");
      this.memoryTracker.stopTracking();
      logger.info("[CLEANUP] Memory tracker stopped");
      this.processingTracker.resetTracker();
      logger.info("[CLEANUP] Processing tracker reset");
      logger.info(
        "[CLEANUP] DataController cleanup completed (memory tracker stopped, processing tracker reset)"
      );
    }
  }

  // Processes
  ProcessCompetitions = async (dataObj) => {
    try {
      logger.info("[COMPETITIONS] Starting competition processing", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Process and assign competitions
      logger.info("[COMPETITIONS] Creating CompetitionProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const competitionProcessor = new CompetitionProcessor(dataObj);

      logger.info("[COMPETITIONS] Calling competitionProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await competitionProcessor.process();

      logger.info("[COMPETITIONS] ProcessCompetitions completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } catch (error) {
      logger.error("[COMPETITIONS] Error in ProcessCompetitions:", error);
      throw error;
    }
  };

  ProcessTeams = async (dataObj) => {
    try {
      logger.info("[TEAMS] Starting team processing", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Process and assign teams
      logger.info("[TEAMS] Creating TeamProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const teamProcessor = new TeamProcessor(dataObj);

      logger.info("[TEAMS] Calling teamProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await teamProcessor.process();

      logger.info("[TEAMS] ProcessTeams completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } catch (error) {
      logger.error("[TEAMS] Error in ProcessTeams:", error);
      throw error;
    }
  };

  ProcessGames = async (dataObj) => {
    try {
      logger.info("[GAMES] Starting game data processing", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Process and assign game data
      logger.info("[GAMES] Creating GameDataProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const gameDataProcessor = new GameDataProcessor(dataObj);

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

      // Store scraped fixtures for use in cleanup phase
      this.scrapedFixtures = result.scrapedFixtures || [];
      logger.info("[GAMES] Stored scraped fixtures for comparison", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedFixturesCount: this.scrapedFixtures.length,
      });

      logger.info("[GAMES] ProcessGames completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedFixturesCount: this.scrapedFixtures.length,
      });
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

      // Reset scraped fixtures on error
      this.scrapedFixtures = [];
      logger.warn("[GAMES] Reset scrapedFixtures due to error", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Re-throw the error to be handled by the main try-catch
      throw error;
    }
  };

  ProcessFixtureValidation = async (dataObj) => {
    try {
      logger.info("[VALIDATION] Starting fixture validation process", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Fetch and validate fixtures
      logger.info("[VALIDATION] Creating FixtureValidationProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const fixtureValidationProcessor = new FixtureValidationProcessor(
        dataObj
      );
      logger.info("[VALIDATION] Calling fixtureValidationProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const validationResult = await fixtureValidationProcessor.process();
      logger.info(
        "[VALIDATION] fixtureValidationProcessor.process() returned",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          resultsCount: validationResult.results?.length || 0,
          fixturesCount: validationResult.fixtures?.length || 0,
        }
      );

      // Store validation results and fixtures (minimal data only)
      this.fixtureValidationResults = validationResult.results || [];
      this.fetchedFixtures = validationResult.fixtures || []; // Now contains only { id, gameID }
      logger.info(
        "[VALIDATION] Stored validation results and fixtures (minimal data)",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          validationResultsCount: this.fixtureValidationResults.length,
          fetchedFixturesCount: this.fetchedFixtures.length,
        }
      );

      // MEMORY OPTIMIZATION: Clear validation results after cleanup if not needed
      // The cleanup phase will use these, then we can clear them

      logger.info("[VALIDATION] Fixture validation complete", {
        fixturesFound: this.fetchedFixtures.length,
        validated: validationResult.validated || 0,
        valid: validationResult.valid || 0,
        invalid: validationResult.invalid || 0,
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } catch (error) {
      logger.error("[VALIDATION] Error in ProcessFixtureValidation:", error);

      // Don't throw error - allow cleanup to proceed even if validation fails
      logger.warn(
        "[VALIDATION] Fixture validation failed, continuing with cleanup (if enabled)",
        {
          method: "ProcessFixtureValidation",
          class: "DataController",
          error: error.message,
        }
      );
      this.fixtureValidationResults = [];
      this.fetchedFixtures = [];
    }
  };

  ProcessFixtureCleanup = async (dataObj) => {
    try {
      logger.info("[CLEANUP] Starting fixture cleanup process", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Log what data we have for comparison
      logger.info("[CLEANUP] Fixture cleanup data availability", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedFixturesCount: (this.scrapedFixtures || []).length,
        fetchedFixturesCount: (this.fetchedFixtures || []).length,
        validationResultsCount: (this.fixtureValidationResults || []).length,
      });

      // Step 1: Compare fixtures using validation results and scraped fixtures
      // TESTING MODE: ProcessGames is disabled, so scrapedFixtures will be empty
      // In testing mode, we only identify fixtures with invalid URLs (404 errors)
      // Missing from scraped data will not be detected (since we're not scraping)
      // ProcessFixtureValidation validates existing DB fixtures for URL validity
      // Comparison identifies fixtures that are invalid (404) based on validation results only
      logger.info("[CLEANUP] Creating FixtureComparisonService", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const comparisonService = new FixtureComparisonService(dataObj);
      logger.info("[CLEANUP] FixtureComparisonService created successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      logger.info("[CLEANUP] Calling compareFixtures", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedCount: (this.scrapedFixtures || []).length,
        fetchedCount: (this.fetchedFixtures || []).length,
        validationCount: (this.fixtureValidationResults || []).length,
        testingMode: true,
        note: "Only invalid URLs (404) will be detected in testing mode (no scraped data)",
      });

      // Compare: database fixtures vs validation results (and scraped fixtures from ProcessGames)
      // TESTING MODE: scrapedFixtures is empty, so only invalid URLs will be identified
      const comparisonResult = comparisonService.compareFixtures(
        this.scrapedFixtures || [], // Empty in testing mode (ProcessGames disabled)
        this.fetchedFixtures || [], // Database fixtures from validation step
        this.fixtureValidationResults || [] // Validation results (identifies invalid URLs - 404 errors)
      );

      logger.info("[CLEANUP] compareFixtures returned successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        fixturesToDelete: comparisonResult.fixturesToDelete?.length || 0,
      });

      logger.info("[CLEANUP] Fixture comparison complete", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        summary: comparisonResult.summary,
        fixturesToDelete: comparisonResult.fixturesToDelete.length,
        invalidUrls: comparisonResult.invalidFixtures.length,
        missingFromSource: comparisonResult.missingFixtures.length,
      });

      // Log fixtures that would be deleted
      if (comparisonResult.fixturesToDelete.length > 0) {
        logger.info(
          `[CLEANUP] === FIXTURES TO DELETE (${comparisonResult.fixturesToDelete.length} total) ===`
        );
        comparisonResult.fixturesToDelete.forEach((fixture, index) => {
          logger.info(
            `[CLEANUP] Fixture ${index + 1}/${
              comparisonResult.fixturesToDelete.length
            } - GameID: ${fixture.gameID || "N/A"}, Reason: ${
              fixture.reason || "unknown"
            }, Status: ${fixture.status || "N/A"}`
          );
        });
        logger.info("[CLEANUP] === END OF FIXTURES TO DELETE ===");
      }

      // Step 2: Delete fixtures
      // Deletion is now ENABLED
      // To disable deletion, set deletionEnabled = false
      // deleteMode options:
      //   - "soft" = mark as deleted (recoverable, sets isDeleted flag)
      //   - "hard" = permanent removal (fixture completely deleted from database, CANNOT be recovered)
      const deletionEnabled = true; // ENABLED - will actually delete fixtures
      const deleteMode = "hard"; // "hard" = PERMANENT removal (⚠️ CANNOT be recovered), "soft" = mark as deleted (recoverable)

      if (deletionEnabled && comparisonResult.fixturesToDelete.length > 0) {
        // Enhanced warning for hard delete
        if (deleteMode === "hard") {
          logger.error(
            `[CLEANUP] ⚠️⚠️⚠️ HARD DELETE ENABLED - ${comparisonResult.fixturesToDelete.length} fixture(s) will be PERMANENTLY REMOVED from database (CANNOT be recovered)`,
            {
              count: comparisonResult.fixturesToDelete.length,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deleteMode: deleteMode,
              warning:
                "HARD DELETE - PERMANENT REMOVAL - DATA CANNOT BE RECOVERED",
              fixtures: comparisonResult.fixturesToDelete.map((f) => ({
                gameID: f.gameID,
                fixtureId: f.fixtureId,
                reason: f.reason,
              })),
            }
          );
        } else {
          logger.warn(
            `[CLEANUP] ⚠️ DELETION ENABLED - ${comparisonResult.fixturesToDelete.length} fixture(s) will be soft deleted (marked as deleted, recoverable)`,
            {
              count: comparisonResult.fixturesToDelete.length,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deleteMode: deleteMode,
              fixtures: comparisonResult.fixturesToDelete.map((f) => ({
                gameID: f.gameID,
                fixtureId: f.fixtureId,
                reason: f.reason,
              })),
            }
          );
        }
        logger.info(
          "[CLEANUP] Deletion enabled - proceeding with fixture deletion",
          {
            count: comparisonResult.fixturesToDelete.length,
            accountId: dataObj.ACCOUNT.ACCOUNTID,
            deleteMode: deleteMode,
          }
        );

        const deletionService = new FixtureDeletionService(dataObj, {
          deleteMode: deleteMode, // "soft" for safety (mark as deleted), "hard" for permanent removal
          enabled: true,
          batchSize: 10,
        });

        // Delete fixtures in batches
        const deleteResults = await deletionService.deleteFixtures(
          comparisonResult.fixturesToDelete
        );

        logger.info("[CLEANUP] Fixture deletion complete", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          deleted: deleteResults.deleted,
          failed: deleteResults.failed,
          skipped: deleteResults.skipped,
          total: deleteResults.total,
        });
      } else {
        // No fixtures to delete OR deletion is disabled
        if (comparisonResult.fixturesToDelete.length === 0) {
          logger.info(
            "[CLEANUP] No fixtures to delete - all fixtures are valid and up-to-date",
            {
              fixturesToDelete: 0,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deletionEnabled: deletionEnabled,
            }
          );
        } else {
          logger.info(
            "[CLEANUP] Deletion disabled - fixtures would be deleted but deletion is not enabled",
            {
              fixturesToDelete: comparisonResult.fixturesToDelete.length,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deletionEnabled: deletionEnabled,
            }
          );
        }
      }

      // Track cleanup results
      logger.info("[CLEANUP] Tracking cleanup results", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        fixturesToDeleteCount: comparisonResult.fixturesToDelete.length,
      });
      this.processingTracker.itemDeleted(
        "fixture-cleanup",
        comparisonResult.fixturesToDelete.length
      );
      logger.info("[CLEANUP] Cleanup results tracked successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      logger.info("[CLEANUP] Fixture cleanup process completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        fixturesToDelete: comparisonResult.fixturesToDelete.length,
        fixturesToKeep: comparisonResult.fixturesToKeep.length,
      });

      // MEMORY OPTIMIZATION: Clear fixture data after cleanup to free memory
      // These arrays can be large (289+ fixtures), so clear them after use
      this.fixtureValidationResults = [];
      this.fetchedFixtures = [];
      // Don't clear scrapedFixtures here - it might be used by other stages
      logger.debug(
        "[CLEANUP] Cleared fixture validation data from memory after cleanup"
      );
    } catch (error) {
      logger.error("[CLEANUP] Error in ProcessFixtureCleanup:", error);

      // Log error but don't throw - allow tracking to complete
      logger.warn(
        "[CLEANUP] Fixture cleanup error - continuing with other stages",
        {
          method: "ProcessFixtureCleanup",
          class: "DataController",
          error: error.message,
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );
    }
  };

  ProcessTracking = async (startTime, collectionID) => {
    try {
      logger.info("[TRACKING] Calculating processing time and memory usage", {
        collectionID: collectionID,
      });
      // Calculate processing time and memory usage
      const TimeTaken = new Date() - startTime;
      const MemoryUsage = this.memoryTracker.getPeakUsage();
      logger.info("[TRACKING] Processing stats calculated", {
        timeTaken: TimeTaken / 1000,
        memoryUsage: MemoryUsage,
        collectionID: collectionID,
      });

      // Update data collection with processing details
      logger.info("[TRACKING] Getting processing tracker data", {
        collectionID: collectionID,
      });
      const processingData = this.processingTracker.getTracker();
      logger.info("[TRACKING] Processing tracker data retrieved", {
        collectionID: collectionID,
        currentStage: processingData.currentStage,
        completedStages: processingData.completedStages?.length || 0,
      });

      logger.info(
        "[TRACKING] Updating data collection with processing details",
        {
          collectionID: collectionID,
          timeTaken: TimeTaken,
          memoryUsage: MemoryUsage,
        }
      );
      await this.CRUDOperations.updateDataCollection(collectionID, {
        TimeTaken,
        MemoryUsage,
        processingTracker: processingData,
      });
      logger.info("[TRACKING] Data collection updated successfully", {
        collectionID: collectionID,
      });

      logger.info(
        `[TRACKING] Data processing completed in ${
          TimeTaken / 1000
        } seconds with peak memory usage: ${MemoryUsage} MB`
      );
    } catch (error) {
      logger.error("[TRACKING] Error in ProcessTracking:", error);
      throw error; // Re-throw to ensure we know if tracking fails
    }
  };
}

module.exports = DataController;
// Developer Notes:
// - This class orchestrates the data processing flow, ensuring data is processed and assigned correctly.
// - Modular design with separate methods for each data category.
// - Enhanced error handling for better debugging and tracking.

// Future Improvements:
// - Consider adding more detailed logging for better monitoring and debugging.
// - Explore the possibility of implementing a more dynamic and flexible error handling mechanism.
// - Investigate options for optimizing memory usage and performance.
