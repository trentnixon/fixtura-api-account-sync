const DataService = require("../services/dataService");
const MemoryTracker = require("../utils/memoryTracker");
const CRUDOperations = require("../services/CRUDoperations");
const ProcessingTracker = require("../services/processingTracker");

const errorHandler = require("../utils/errorHandler");
const logger = require("../../src/utils/logger");

// Import components
const BrowserManager = require("./components/core/browserManager");
const DataSyncOperations = require("./components/core/dataSyncOperations");
const StageOrchestrator = require("./components/stageOrchestrator");

class DataController {
  constructor(fromRedis) {
    this.fromRedis = fromRedis;
    this.dataService = new DataService();
    this.memoryTracker = new MemoryTracker();
    this.CRUDOperations = new CRUDOperations();
    this.dataSyncOperations = new DataSyncOperations(
      this.dataService,
      fromRedis
    );
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
    return await BrowserManager.forceBrowserRestartIfNeeded();
  }

  async reSyncData() {
    return await this.dataSyncOperations.reSyncData();
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
    return await this.dataSyncOperations.reSyncDataDirect(orgId, orgType);
  }

  /**
   * Update account data only - fetches fresh account data without processing competitions, teams, or games.
   * This is used for on-demand account updates that only refresh account metadata.
   */
  async updateAccountOnly() {
    return await this.dataSyncOperations.updateAccountOnly();
  }

  /**
   * Start the data processing pipeline
   * @param {string|object} configOrPreset - Processing configuration (preset name or config object)
   *                                        - Available presets: 'full', 'quick', 'validation-only', 'data-only', 'minimal'
   *                                        - Or pass a custom config object with stages, refreshDataBetweenStages, etc.
   * @returns {Promise<object>} Processing result
   */
  async start(configOrPreset) {
    try {
      const fixtureData = {
        scrapedFixtures: this.scrapedFixtures,
        fetchedFixtures: this.fetchedFixtures,
        fixtureValidationResults: this.fixtureValidationResults,
      };

      const result = await StageOrchestrator.execute({
        dataService: this.dataService,
        memoryTracker: this.memoryTracker,
        processingTracker: this.processingTracker,
        CRUDOperations: this.CRUDOperations,
        reSyncData: () => this.reSyncData(),
        fixtureData: fixtureData,
        config: configOrPreset, // Pass configuration to orchestrator
      });

      // Sync fixture data back to instance
      this.scrapedFixtures = fixtureData.scrapedFixtures;
      this.fetchedFixtures = fixtureData.fetchedFixtures;
      this.fixtureValidationResults = fixtureData.fixtureValidationResults;

      return result;
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
