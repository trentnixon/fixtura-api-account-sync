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
 * Stage orchestrator - simple stage execution
 */
class StageOrchestrator {
  /**
   * Execute processing pipeline based on config
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

    // Load config
    const config = ProcessingConfig.create(configOrPreset);
    logger.info("[CONFIG] Stages enabled:");
    logger.info(`[CONFIG]   competitions: ${config.stages.competitions}`);
    logger.info(`[CONFIG]   teams: ${config.stages.teams}`);
    logger.info(`[CONFIG]   games: ${config.stages.games}`);
    logger.info(
      `[CONFIG]   fixture-validation: ${config.stages["fixture-validation"]}`
    );
    logger.info(
      `[CONFIG]   fixture-cleanup: ${config.stages["fixture-cleanup"]}`
    );
    logger.info(`[CONFIG]   tracking: ${config.stages.tracking}`);

    memoryTracker.startTracking();
    const startTime = new Date();

    // Fetch data and create collection
    let dataObj = await reSyncData();
    const collectionID = await dataService.initCreateDataCollection(
      dataObj.ACCOUNT.ACCOUNTID
    );
    await processingTracker.updateDatabaseAfterAction(collectionID);

    // COMPETITIONS
    if (config.stages.competitions) {
      logger.info("[COMPETITIONS] Starting");
      await processingTracker.setCurrentStage("competitions", collectionID);
      try {
        await CompetitionProcessorComponent.process(dataObj);
      } catch (error) {
        logger.error("[COMPETITIONS] Error:", error.message);
      }
      await processingTracker.completeStage("competitions", collectionID);

      if (memoryTracker) {
        const stats = memoryTracker.logMemoryStats("COMPETITIONS");
        logger.info(`[COMPETITIONS] Memory: RSS=${stats.rss.toFixed(2)} MB`);
      }

      if (config.forceBrowserRestart?.afterCompetitions) {
        await BrowserManager.forceBrowserRestartIfNeeded();
      }

      // STOP if competitions-only (but continue if validation/cleanup are enabled)
      if (
        config.stages.competitions &&
        !config.stages.teams &&
        !config.stages.games &&
        !config.stages["fixture-validation"] &&
        !config.stages["fixture-cleanup"]
      ) {
        logger.info("[COMPETITIONS] Competitions-only mode - stopping here");
        return { Complete: true };
      }

      if (config.refreshDataBetweenStages) {
        dataObj = await reSyncData();
      }
    }

    // TEAMS
    if (config.stages.teams) {
      logger.info("[TEAMS] Starting");
      await processingTracker.setCurrentStage("teams", collectionID);
      try {
        await TeamProcessorComponent.process(dataObj);
      } catch (error) {
        logger.error("[TEAMS] Error:", error.message);
      }
      await processingTracker.completeStage("teams", collectionID);

      if (config.forceBrowserRestart?.afterTeams) {
        await BrowserManager.forceBrowserRestartIfNeeded();
      }

      if (config.refreshDataBetweenStages) {
        dataObj = await reSyncData();
      }
    }

    // GAMES
    if (config.stages.games) {
      logger.info("[GAMES] Starting");
      await processingTracker.setCurrentStage("games", collectionID);
      try {
        const gameResult = await GameProcessorComponent.process(dataObj, {
          memoryTracker: memoryTracker,
          isolateByCategory: process.env.ISOLATE_BY_CATEGORY === "true",
        });
        fixtureData.scrapedFixtures = gameResult.scrapedFixtures || [];
      } catch (error) {
        logger.error("[GAMES] Error:", error.message);
        fixtureData.scrapedFixtures = [];
      }
      await processingTracker.completeStage("games", collectionID);

      if (config.forceBrowserRestart?.afterGames) {
        await BrowserManager.forceBrowserRestartIfNeeded();
      }

      if (config.refreshDataBetweenStages) {
        dataObj = await reSyncData();
        if (global.gc) global.gc();
      }
    }

    // VALIDATION
    logger.info(
      `[VALIDATION] Config check: fixture-validation=${
        config.stages["fixture-validation"]
      } (type: ${typeof config.stages["fixture-validation"]})`
    );
    if (config.stages["fixture-validation"]) {
      logger.info("[VALIDATION] Starting");
      await processingTracker.setCurrentStage(
        "fixture-validation",
        collectionID
      );
      try {
        const validationResult =
          await FixtureValidationProcessorComponent.process(dataObj);
        fixtureData.fixtureValidationResults = validationResult.results || [];
        fixtureData.fetchedFixtures = validationResult.fixtures || [];
      } catch (error) {
        logger.error("[VALIDATION] Error:", error.message);
      }
      await processingTracker.completeStage("fixture-validation", collectionID);
    }

    // CLEANUP
    logger.info(
      `[CLEANUP] Config check: fixture-cleanup=${
        config.stages["fixture-cleanup"]
      } (type: ${typeof config.stages["fixture-cleanup"]})`
    );
    if (config.stages["fixture-cleanup"]) {
      logger.info("[CLEANUP] Starting");
      await processingTracker.setCurrentStage("fixture-cleanup", collectionID);
      try {
        await FixtureCleanupProcessorComponent.process(
          dataObj,
          {
            scrapedFixtures: fixtureData.scrapedFixtures || [],
            fetchedFixtures: fixtureData.fetchedFixtures || [],
            fixtureValidationResults:
              fixtureData.fixtureValidationResults || [],
          },
          processingTracker
        );
        fixtureData.fixtureValidationResults = [];
        fixtureData.fetchedFixtures = [];
      } catch (error) {
        logger.error("[CLEANUP] Error:", error.message);
      }
      await processingTracker.completeStage("fixture-cleanup", collectionID);
    }

    // TRACKING
    if (config.stages.tracking) {
      logger.info("[TRACKING] Starting");
      await TrackingProcessorComponent.process(
        startTime,
        collectionID,
        memoryTracker,
        processingTracker,
        CRUDOperations
      );
    }

    logger.info("[COMPLETE] Finished");
    return { Complete: true };
  }
}

module.exports = StageOrchestrator;
