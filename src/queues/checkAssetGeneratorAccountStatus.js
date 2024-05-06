const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const {
  startAssetBundleCreation,
  setSyncAccountFixtures,
} = require("../config/queueConfig");

// This module handles job addition to queues with robust error management, facilitating operations related to asset generator account status checking.

function getWeekOfYear(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

async function checkAssetGeneratorAccountStatus() {
  logger.info("Running checkAssetGeneratorAccountStatus");
  startAssetBundleCreation.process(async (job) => {
    try {
      const { PATH, ID, processGameData } = job.data.getSync;
      logger.debug(`Processing job with ID: ${ID}, path: ${PATH}`);
      logger.debug(`Processing job Data collection is : ${processGameData}`);

      if (processGameData) {
        // AMEND THIS PROCESS TO ONLY PROCESS GAMES
        let processor =
          PATH === "CLUB"
            ? new ClubTaskProcessor()
            : new AssociationTaskProcessor();
        await processor.process(job);
        logger.info(`Successfully processed taskRunner for ID: ${ID}`);
      } else {
        logger.warn(
          `Account ID: ${ID} has already collected data within the last 24 hours`
        );
      }
    } catch (error) {
      logger.error(
        `Error processing taskRunner for ID: ${job.data.getSync.ID}: ${error.message}`,
        {
          jobData: job.data,
          errorStack: error.stack,
        }
      );
      throw error;
    }
  });

  startAssetBundleCreation.on("completed", (job) => {
    const weekOfYear = getWeekOfYear(new Date());
    logger.info(
      `Job completed: ${job.id} for account ID: ${job.data.getSync.ID}`
    );
    setSyncAccountFixtures.add({
      accountId: job.data.getSync.ID,
      weekOfYear,
    });
  }); 

  startAssetBundleCreation.on("failed", (job, error) => {
    logger.error(`Job failed: ${job.id}, error: ${error.message}`);
    setSyncAccountFixtures.add({
      accountId: job.data.getSync.ID,
      weekOfYear: getWeekOfYear(new Date()),
    });
    queueErrorHandler("taskRunner", error);
  });
}

module.exports = checkAssetGeneratorAccountStatus;

// Developer Notes:
// - Refactoring added centralized logging for better traceability.
// - Error handling has been standardized to provide more detailed diagnostic information.
// - Introduced conditional processing based on the type of task processor required.

// Future Improvements:
// - Consider integrating with a monitoring service for real-time alerts on job status.
// - Improve job data structure for clearer role separation and error diagnosis.

// Additional Notes for LLM:
// - This function processes jobs related to asset generation account status in a Redis queue system.
// - It sits within the utilities for managing tasks in the application, specifically under `/tasks` directory.
// - It leverages external task processors for clubs and associations based on the job's data context.
