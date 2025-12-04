const logger = require("../../../../src/utils/logger");

/**
 * Tracking processing component
 */
class TrackingProcessorComponent {
  /**
   * Process tracking and update data collection
   * @param {Date} startTime - Start time of the processing
   * @param {number} collectionID - Data collection ID
   * @param {object} memoryTracker - Memory tracker instance
   * @param {object} processingTracker - Processing tracker instance
   * @param {object} CRUDOperations - CRUD operations instance
   */
  static async process(startTime, collectionID, memoryTracker, processingTracker, CRUDOperations) {
    try {
      logger.info("[TRACKING] Calculating processing time and memory usage", {
        collectionID: collectionID,
      });
      // Calculate processing time and memory usage
      const TimeTaken = new Date() - startTime;
      const MemoryUsage = memoryTracker.getPeakUsage();
      logger.info("[TRACKING] Processing stats calculated", {
        timeTaken: TimeTaken / 1000,
        memoryUsage: MemoryUsage,
        collectionID: collectionID,
      });

      // Update data collection with processing details
      logger.info("[TRACKING] Getting processing tracker data", {
        collectionID: collectionID,
      });
      const processingData = processingTracker.getTracker();
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
      await CRUDOperations.updateDataCollection(collectionID, {
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
  }
}

module.exports = TrackingProcessorComponent;

