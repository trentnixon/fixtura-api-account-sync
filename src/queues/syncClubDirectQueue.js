const logger = require("../utils/logger");
const queueStateManager = require("../utils/queueStateManager");
const { syncClubDirect } = require("../config/queueConfig");
const setupQueueHandler = require("./baseQueueHandler");

/**
 * Function to handle direct club ID processing from the queue.
 * Processes jobs that use club ID directly (without account lookup).
 * Uses pseudo/sudo account ID to satisfy data structure requirements.
 */
async function handleClubDirectSync(testData = null) {
  const processJob = async (jobData) => {
    const clubId = jobData.getSync?.ID;
    const accountPath = jobData.getSync?.PATH;

    // Validate job data before processing
    if (!clubId) {
      logger.error("❌ CRITICAL: No club ID found in job data", {
        jobData: jobData,
        getSync: jobData.getSync,
      });
      throw new Error("Missing club ID in job data");
    }

    // Validate that PATH is CLUB
    if (accountPath !== "CLUB") {
      logger.error("❌ CRITICAL: Invalid PATH for club direct sync", {
        clubId: clubId,
        accountPath: accountPath,
        jobData: jobData,
      });
      throw new Error(
        `Invalid PATH for club direct sync: ${accountPath}. Expected "CLUB"`
      );
    }

    logger.info("🔄 Starting syncClubDirect job processing", {
      clubId: clubId,
      accountPath: accountPath,
      jobData: jobData,
    });

    try {
      logger.debug(`Processing syncClubDirect job with club ID: ${clubId}`);

      // Use ClubDirectTaskProcessor for direct club processing
      const ClubDirectTaskProcessor = require("../tasks/clubDirectTaskProcessor");
      const processor = new ClubDirectTaskProcessor();
      await processor.process({ data: jobData });
    } catch (error) {
      logger.error("❌ Error processing syncClubDirect task", {
        clubId: clubId,
        accountPath: accountPath,
        error: error.message,
        stack: error.stack,
        jobData: jobData,
      });
      throw error;
    }
  };

  // Setup queue handler with base handler
  const handler = setupQueueHandler(syncClubDirect, "syncClubDirect", {
    processor: async (job) => {
      await processJob(job.data);
    },
    browserCleanup: true,
    notifications: {
      type: "direct_org",
      orgType: "CLUB",
      onSuccess: true,
      onFailure: true,
    },
    eventListeners: {
      failed: true,
      completed: true,
      stalled: true,
    },
    testDataSupport: true,
    queueErrorHandler: "syncClubDirect",
    onFailed: async (job, error) => {
      const clubId = job.data.getSync?.ID;

      // Only treat as error if it's not a stall-related error
      // Stall errors are handled by the stalled event above
      if (error.message && error.message.includes("stalled")) {
        logger.info("ℹ️ syncClubDirect job exceeded stall limit", {
          jobId: job.id,
          clubId: clubId,
          message:
            "Job took longer than 2 hours. This may indicate a very large club or performance issue.",
        });

        // Safety net: Resume queues even for stalled jobs
        try {
          await queueStateManager.resumeAllQueues(
            `Job stalled: syncClubDirect (ID: ${job.id}, Club: ${clubId || "UNKNOWN"})`
          );
        } catch (resumeError) {
          logger.error(
            "[syncClubDirect] Error resuming queues in stalled handler",
            { error: resumeError.message }
          );
        }

        // Log failure with prominent org ID
        if (clubId) {
          logger.error("❌ syncClubDirect job failed", {
            jobId: job.id,
            clubId: clubId,
            orgType: "CLUB",
            error: error.message,
            stack: error.stack,
          });
        }

        // Return true to skip default failed handling
        return true;
      }

      // Return false to continue with default failed handling
      return false;
    },
  });

  await handler(testData);
}

module.exports = handleClubDirectSync;
