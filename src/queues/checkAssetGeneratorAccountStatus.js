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
  console.log("=== checkAssetGeneratorAccountStatus START ===");
  logger.info("Running checkAssetGeneratorAccountStatus");

  // Debug: Check if queues are properly initialized
  console.log("Queue objects:", {
    startAssetBundleCreation: !!startAssetBundleCreation,
    setSyncAccountFixtures: !!setSyncAccountFixtures,
  });

  logger.info(
    `startAssetBundleCreation queue initialized: ${!!startAssetBundleCreation}`
  );
  logger.info(
    `setSyncAccountFixtures queue initialized: ${!!setSyncAccountFixtures}`
  );

  console.log("Setting up startAssetBundleCreation processor...");
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
  console.log("startAssetBundleCreation processor setup complete");

  // Debug: Log when setting up setSyncAccountFixtures processor
  console.log("Setting up setSyncAccountFixtures processor...");
  logger.info("Setting up setSyncAccountFixtures processor...");

  try {
    setSyncAccountFixtures.process(async (job) => {
      try {
        const { accountId, weekOfYear } = job.data;
        console.log(`🎯 PROCESSING setSyncAccountFixtures job:`, {
          accountId,
          weekOfYear,
        });
        logger.info(
          `Processing setSyncAccountFixtures for account ${accountId}, week ${weekOfYear}`
        );

        // TODO: Implement the actual fixture sync logic here
        // This should handle syncing fixtures for the specific account and week
        console.log(
          `Syncing fixtures for account ${accountId}, week ${weekOfYear}`
        );

        // For now, just log completion
        logger.info(
          `Successfully processed setSyncAccountFixtures for account ${accountId}, week ${weekOfYear}`
        );
      } catch (error) {
        logger.error(
          `Error processing setSyncAccountFixtures job ${job.id}: ${error.message}`,
          {
            jobData: job.data,
            errorStack: error.stack,
          }
        );
        throw error;
      }
    });
    console.log("✅ setSyncAccountFixtures processor setup complete");
  } catch (error) {
    console.error(
      "❌ Error setting up setSyncAccountFixtures processor:",
      error
    );
    throw error;
  }

  logger.info("setSyncAccountFixtures processor setup complete");

  console.log("Setting up event listeners...");
  startAssetBundleCreation.on("completed", (job) => {
    const weekOfYear = getWeekOfYear(new Date());
    logger.info(
      `Job completed: ${job.id} for account ID: ${job.data.getSync.ID}`
    );
    logger.info(
      `Adding job to setSyncAccountFixtures queue: accountId=${job.data.getSync.ID}, weekOfYear=${weekOfYear}`
    );

    // Add more visible logging
    console.log(
      `🚀 QUEUE TRANSITION: Adding job to setSyncAccountFixtures for account ${job.data.getSync.ID}, week ${weekOfYear}`
    );

    setSyncAccountFixtures.add({
      accountId: job.data.getSync.ID,
      weekOfYear,
    });
  });

  startAssetBundleCreation.on("failed", (job, error) => {
    logger.error(`Job failed: ${job.id}, error: ${error.message}`);
    const weekOfYear = getWeekOfYear(new Date());
    logger.info(
      `Adding failed job to setSyncAccountFixtures queue: accountId=${job.data.getSync.ID}, weekOfYear=${weekOfYear}`
    );
    setSyncAccountFixtures.add({
      accountId: job.data.getSync.ID,
      weekOfYear,
    });
    queueErrorHandler("taskRunner", error);
  });

  // Event listeners for setSyncAccountFixtures
  setSyncAccountFixtures.on("completed", (job) => {
    console.log(
      `🎉 setSyncAccountFixtures job ${job.id} completed for account ${job.data.accountId}`
    );
    logger.info(
      `setSyncAccountFixtures job ${job.id} completed successfully for account ${job.data.accountId}`
    );
  });

  setSyncAccountFixtures.on("failed", (job, error) => {
    console.error(
      `💥 setSyncAccountFixtures job ${job.id} failed: ${error.message}`
    );
    logger.error(
      `setSyncAccountFixtures job ${job.id} failed: ${error.message}`
    );
  });

  console.log("Event listeners setup complete");
  logger.info("checkAssetGeneratorAccountStatus setup complete");
  console.log("=== checkAssetGeneratorAccountStatus COMPLETE ===");
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
