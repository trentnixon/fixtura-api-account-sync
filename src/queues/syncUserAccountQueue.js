const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const { syncUserAccount } = require("../config/queueConfig");
const setupQueueHandler = require("./baseQueueHandler");

/**
 * Function to synchronize user accounts by processing tasks from the queue.
 * Handles specific tasks based on the type (club or association).
 */
async function handleAccountSync(testData = null) {
  const processJob = async (jobData) => {
    const accountId = jobData.getSync?.ID;
    const accountPath = jobData.getSync?.PATH;

    // Validate job data before processing
    if (!accountId) {
      logger.error("❌ CRITICAL: No account ID found in job data", {
        jobData: jobData,
        getSync: jobData.getSync,
      });
      throw new Error("Missing account ID in job data");
    }

    logger.info("🔄 Starting syncUserAccount job processing", {
      accountId: accountId,
      accountPath: accountPath,
      jobData: jobData,
    });

    try {
      logger.debug(
        `Processing job with ID: ${accountId} on path: ${accountPath}`
      );

      if (accountPath === "CLUB") {
        logger.info("🏢 Processing CLUB account", { accountId: accountId });
        const clubProcessor = new ClubTaskProcessor();
        await clubProcessor.process({ data: jobData });
      } else if (accountPath === "ASSOCIATION") {
        logger.info("🏛️ Processing ASSOCIATION account", {
          accountId: accountId,
        });
        const associationProcessor = new AssociationTaskProcessor();
        await associationProcessor.process({ data: jobData });
      } else {
        logger.error("❌ Unknown account path", {
          accountId: accountId,
          accountPath: accountPath,
          jobData: jobData,
        });
        throw new Error(`Unknown account path: ${accountPath}`);
      }

      logger.info("✅ Successfully processed syncUserAccount task", {
        accountId: accountId,
        accountPath: accountPath,
      });
    } catch (error) {
      logger.error("❌ Error processing syncUserAccount task", {
        accountId: accountId,
        accountPath: accountPath,
        error: error.message,
        stack: error.stack,
        jobData: jobData,
      });
      throw error;
    }
  };

  // Setup queue handler with base handler
  const handler = setupQueueHandler(syncUserAccount, "syncUserAccount", {
    processor: async (job) => {
      await processJob(job.data);
    },
    browserCleanup: true,
    notifications: {
      type: "cms_account",
      onSuccess: true,
      onFailure: true,
    },
    eventListeners: {
      failed: true,
      completed: true,
      stalled: false,
    },
    testDataSupport: true,
    queueErrorHandler: "syncUserAccount",
  });

  await handler(testData);
}

module.exports = handleAccountSync;
