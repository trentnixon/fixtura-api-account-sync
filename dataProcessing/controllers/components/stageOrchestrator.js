const logger = require("../../../src/utils/logger");
const BrowserManager = require("./core/browserManager");
const ProcessingConfig = require("./core/processingConfig");
const CompetitionProcessorComponent = require("./stages/competitionProcessor");
const TeamProcessorComponent = require("./stages/teamProcessor");
const GameProcessorComponent = require("./stages/gameProcessor");
const FixtureValidationProcessorComponent = require("./stages/fixtureValidationProcessor");
const FixtureCleanupProcessorComponent = require("./stages/fixtureCleanupProcessor");
const TrackingProcessorComponent = require("./stages/trackingProcessor");

/**
 * Stage orchestrator component - handles the main processing flow
 */
class StageOrchestrator {
  /**
   * Execute the complete processing pipeline
   * @param {object} context - Processing context
   * @param {object} context.dataService - Data service instance
   * @param {object} context.memoryTracker - Memory tracker instance
   * @param {object} context.processingTracker - Processing tracker instance
   * @param {object} context.CRUDOperations - CRUD operations instance
   * @param {Function} context.reSyncData - Function to re-sync data
   * @param {object} context.fixtureData - Object to store fixture data arrays
   * @param {object|string} context.config - Processing configuration (preset name or config object)
   */
  static async execute(context) {
    const {
      dataService,
      memoryTracker,
      processingTracker,
      CRUDOperations,
      reSyncData,
      fixtureData,
      config: configOrPreset,
    } = context;

    // Create and validate configuration
    const config = ProcessingConfig.create(configOrPreset);
    logger.info("[CONFIG] Processing configuration loaded", {
      enabledStages: ProcessingConfig.getEnabledStages(config),
      refreshDataBetweenStages: config.refreshDataBetweenStages,
    });

    memoryTracker.startTracking();
    const startTime = new Date();

    // Fetch data
    let dataObj = await reSyncData();

    // Create a data collection entry
    const collectionID = await dataService.initCreateDataCollection(
      dataObj.ACCOUNT.ACCOUNTID
    );
    await processingTracker.updateDatabaseAfterAction(collectionID);

    // ========================================
    // [STAGE] PROCESS COMPETITIONS
    // ========================================
    if (
      ProcessingConfig.isStageEnabled(
        config,
        ProcessingConfig.STAGES.COMPETITIONS
      )
    ) {
      logger.info("[STAGE] Starting competitions stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.setCurrentStage("competitions", collectionID);
      logger.info("[STAGE] setCurrentStage('competitions') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      try {
        await CompetitionProcessorComponent.process(dataObj);
      } catch (error) {
        logger.error(
          "[STAGE] Error in ProcessCompetitions, but continuing to next stage",
          {
            error: error.message,
            accountId: dataObj.ACCOUNT.ACCOUNTID,
          }
        );
        // Don't throw - allow processing to continue
      }
      await processingTracker.completeStage("competitions", collectionID);
      logger.info("[STAGE] completeStage('competitions') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        trackerData: processingTracker.getTracker().competitions,
      });

      // MEMORY OPTIMIZATION: Force browser restart between stages to free memory
      if (config.forceBrowserRestart?.afterCompetitions) {
        await BrowserManager.forceBrowserRestartIfNeeded();
      }

      // Refresh data between stages if configured
      if (config.refreshDataBetweenStages) {
        logger.info("[START] Refreshing data after competitions", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
        // MEMORY FIX: Clear old dataObj reference before fetching new one
        let oldDataObj = dataObj;
        dataObj = await reSyncData();
        oldDataObj = null; // Help GC free old dataObj
        logger.info("[START] Data refreshed successfully after competitions", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
      }
    } else {
      logger.info(
        "[STAGE] Skipping competitions stage (disabled in configuration)",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );
    }

    // ========================================
    // [STAGE] PROCESS TEAMS
    // ========================================
    if (
      ProcessingConfig.isStageEnabled(config, ProcessingConfig.STAGES.TEAMS)
    ) {
      logger.info("[STAGE] Starting teams stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.setCurrentStage("teams", collectionID);
      logger.info("[STAGE] setCurrentStage('teams') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      try {
        await TeamProcessorComponent.process(dataObj);
      } catch (error) {
        logger.error(
          "[STAGE] Error in ProcessTeams, but continuing to next stage",
          {
            error: error.message,
            accountId: dataObj.ACCOUNT.ACCOUNTID,
          }
        );
        // Don't throw - allow processing to continue
      }
      await processingTracker.completeStage("teams", collectionID);
      logger.info("[STAGE] completeStage('teams') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        trackerData: processingTracker.getTracker().teams,
      });

      // MEMORY OPTIMIZATION: Force browser restart between stages to free memory
      if (config.forceBrowserRestart?.afterTeams) {
        await BrowserManager.forceBrowserRestartIfNeeded();
      }

      // Refresh data between stages if configured
      if (config.refreshDataBetweenStages) {
        logger.info("[START] Refreshing data after teams", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
        // MEMORY FIX: Clear old dataObj reference before fetching new one
        let oldDataObj = dataObj; // Reuse variable, don't redeclare
        dataObj = await reSyncData();
        oldDataObj = null; // Help GC free old dataObj
        logger.info("[START] Data refreshed successfully after teams", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
      }
    } else {
      logger.info("[STAGE] Skipping teams stage (disabled in configuration)", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    }

    // ========================================
    // [STAGE] PROCESS GAMES
    // ========================================
    if (
      ProcessingConfig.isStageEnabled(config, ProcessingConfig.STAGES.GAMES)
    ) {
      logger.info("[STAGE] Starting games stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.setCurrentStage("games", collectionID);
      logger.info("[STAGE] setCurrentStage('games') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[GAMES] Calling ProcessGames", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      try {
        const gameResult = await GameProcessorComponent.process(dataObj);
        // MEMORY FIX: Store scraped fixtures immediately
        fixtureData.scrapedFixtures = gameResult.scrapedFixtures || [];
        logger.info("[GAMES] ProcessGames returned successfully", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          scrapedFixturesCount: fixtureData.scrapedFixtures.length,
        });
      } catch (error) {
        logger.error(
          "[STAGE] Error in ProcessGames, but continuing to next stage",
          {
            error: error.message,
            accountId: dataObj.ACCOUNT.ACCOUNTID,
          }
        );
        // Reset scraped fixtures on error
        fixtureData.scrapedFixtures = [];
        logger.warn("[GAMES] Reset scrapedFixtures due to error", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
        // Don't throw - allow processing to continue
      }
      await processingTracker.completeStage("games", collectionID);
      logger.info("[STAGE] completeStage('games') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        trackerData: processingTracker.getTracker().games,
      });

      // MEMORY OPTIMIZATION: Force browser restart between stages to free memory
      if (config.forceBrowserRestart?.afterGames) {
        await BrowserManager.forceBrowserRestartIfNeeded();
      }

      // Refresh data between stages if configured
      if (config.refreshDataBetweenStages) {
        logger.info("[START] Refreshing data after games", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
        // MEMORY FIX: Clear old dataObj reference before fetching new one
        let oldDataObj = dataObj; // Reuse variable, don't redeclare
        dataObj = await reSyncData();
        oldDataObj = null; // Help GC free old dataObj

        // MEMORY FIX: Force GC hint after games stage (largest memory consumer)
        if (global.gc) {
          global.gc();
        }

        logger.info("[START] Data refreshed successfully after games", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        });
      }
    } else {
      logger.info("[STAGE] Skipping games stage (disabled in configuration)", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    }

    // ========================================
    // [STAGE] PROCESS FIXTURE VALIDATION
    // ========================================
    // NOTE: Validation must run before Cleanup - Cleanup needs validation results
    if (
      ProcessingConfig.isStageEnabled(
        config,
        ProcessingConfig.STAGES.FIXTURE_VALIDATION
      )
    ) {
      logger.info("[STAGE] Starting fixture-validation stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.setCurrentStage(
        "fixture-validation",
        collectionID
      );
      logger.info("[STAGE] setCurrentStage('fixture-validation') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[VALIDATION] Calling ProcessFixtureValidation", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const validationResult =
        await FixtureValidationProcessorComponent.process(dataObj);

      // Store validation results and fixtures (minimal data only)
      fixtureData.fixtureValidationResults = validationResult.results || [];
      fixtureData.fetchedFixtures = validationResult.fixtures || [];

      logger.info(
        "[VALIDATION] ProcessFixtureValidation returned successfully",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          validationResultsCount: fixtureData.fixtureValidationResults.length,
          fetchedFixturesCount: fixtureData.fetchedFixtures.length,
        }
      );

      logger.info("[STAGE] Completing fixture-validation stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.completeStage("fixture-validation", collectionID);
      logger.info("[STAGE] completeStage('fixture-validation') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } else {
      logger.info(
        "[STAGE] Skipping fixture-validation stage (disabled in configuration)",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );
    }

    // ========================================
    // [STAGE] PROCESS FIXTURE CLEANUP
    // ========================================
    if (
      ProcessingConfig.isStageEnabled(
        config,
        ProcessingConfig.STAGES.FIXTURE_CLEANUP
      )
    ) {
      logger.info("[STAGE] Starting fixture-cleanup stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.setCurrentStage("fixture-cleanup", collectionID);
      logger.info("[STAGE] setCurrentStage('fixture-cleanup') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[CLEANUP] Calling ProcessFixtureCleanup", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      await FixtureCleanupProcessorComponent.process(
        dataObj,
        {
          scrapedFixtures: fixtureData.scrapedFixtures || [],
          fetchedFixtures: fixtureData.fetchedFixtures || [],
          fixtureValidationResults: fixtureData.fixtureValidationResults || [],
        },
        processingTracker
      );
      logger.info("[CLEANUP] ProcessFixtureCleanup returned successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      logger.info("[STAGE] Completing fixture-cleanup stage", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await processingTracker.completeStage("fixture-cleanup", collectionID);
      logger.info("[STAGE] completeStage('fixture-cleanup') completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // MEMORY OPTIMIZATION: Clear fixture data after cleanup to free memory
      // These arrays can be large (289+ fixtures), so clear them after use
      fixtureData.fixtureValidationResults = [];
      fixtureData.fetchedFixtures = [];
      // Don't clear scrapedFixtures here - it might be used by other stages
      logger.debug(
        "[CLEANUP] Cleared fixture validation data from memory after cleanup"
      );
    } else {
      logger.info(
        "[STAGE] Skipping fixture-cleanup stage (disabled in configuration)",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );
    }

    // ========================================
    // [TRACKING] PROCESS TRACKING
    // ========================================
    if (
      ProcessingConfig.isStageEnabled(config, ProcessingConfig.STAGES.TRACKING)
    ) {
      logger.info("[TRACKING] Starting ProcessTracking", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        collectionID: collectionID,
      });
      await TrackingProcessorComponent.process(
        startTime,
        collectionID,
        memoryTracker,
        processingTracker,
        CRUDOperations
      );
      logger.info("[TRACKING] ProcessTracking completed", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
    } else {
      logger.info(
        "[TRACKING] Skipping tracking stage (disabled in configuration)",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );
    }

    logger.info("[COMPLETE] DataController.start() completed successfully", {
      accountId: dataObj.ACCOUNT.ACCOUNTID,
      collectionID: collectionID,
    });

    return { Complete: true };
  }
}

module.exports = StageOrchestrator;
