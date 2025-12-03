const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const { startAssetBundleCreation } = require("../config/queueConfig");
const setupQueueHandler = require("./baseQueueHandler");

async function checkAssetGeneratorAccountStatus() {
  console.log("=== checkAssetGeneratorAccountStatus START ===");
  logger.info("Running checkAssetGeneratorAccountStatus");

  // Debug: Check if queue is properly initialized
  console.log("Queue object:", {
    startAssetBundleCreation: !!startAssetBundleCreation,
  });

  logger.info(
    `startAssetBundleCreation queue initialized: ${!!startAssetBundleCreation}`
  );

  console.log("Setting up startAssetBundleCreation processor...");

  // Setup queue handler with base handler
  const handler = setupQueueHandler(
    startAssetBundleCreation,
    "startAssetBundleCreation",
    {
      processor: async (job) => {
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
      },
      browserCleanup: false,
      notifications: {
        type: "cms_account",
        onSuccess: true,
        onFailure: true,
      },
      eventListeners: {
        failed: true,
        completed: false,
        stalled: false,
      },
      testDataSupport: false,
      queueErrorHandler: null,
    }
  );

  await handler();

  console.log("startAssetBundleCreation processor setup complete");
  console.log("Event listeners setup complete");
  logger.info("checkAssetGeneratorAccountStatus setup complete");
  console.log("=== checkAssetGeneratorAccountStatus COMPLETE ===");
}

module.exports = checkAssetGeneratorAccountStatus;
