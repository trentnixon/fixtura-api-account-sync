const logger = require("../utils/logger");
const UpdateAccountOnlyProcessor = require("../tasks/updateAccountOnlyProcessor");
const { updateAccountOnly } = require("../config/queueConfig");
const setupQueueHandler = require("./baseQueueHandler");

/**
 * Function to handle on-demand account updates from the queue.
 * Processes jobs that perform full sync (competitions, teams, games, data collections)
 * without handoff to another worker.
 */
async function handleUpdateAccountOnly(testData = null) {
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

    logger.info("🔄 Starting updateAccountOnly job processing", {
      accountId: accountId,
      accountPath: accountPath,
      jobData: jobData,
    });

    try {
      logger.debug(
        `Processing updateAccountOnly job with ID: ${accountId} on path: ${accountPath}`
      );

      // Use UpdateAccountOnlyProcessor which works for both CLUB and ASSOCIATION
      const processor = new UpdateAccountOnlyProcessor();
      await processor.process({ data: jobData });

      logger.info("✅ Successfully processed updateAccountOnly task", {
        accountId: accountId,
        accountPath: accountPath,
      });
    } catch (error) {
      logger.error("❌ Error processing updateAccountOnly task", {
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
  const handler = setupQueueHandler(updateAccountOnly, "updateAccountOnly", {
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
    queueErrorHandler: "updateAccountOnly",
  });

  await handler(testData);
}

module.exports = handleUpdateAccountOnly;
