const logger = require("../utils/logger");
const queueStateManager = require("../utils/queueStateManager");
const { syncAssociationDirect } = require("../config/queueConfig");
const setupQueueHandler = require("./baseQueueHandler");

/**
 * Function to handle direct association ID processing from the queue.
 * Processes jobs that use association ID directly (without account lookup).
 * Uses pseudo/sudo account ID to satisfy data structure requirements.
 */
async function handleAssociationDirectSync(testData = null) {
  const processJob = async (jobData) => {
    const associationId = jobData.getSync?.ID;
    const accountPath = jobData.getSync?.PATH;

    // Validate job data before processing
    if (!associationId) {
      logger.error("❌ CRITICAL: No association ID found in job data", {
        jobData: jobData,
        getSync: jobData.getSync,
      });
      throw new Error("Missing association ID in job data");
    }

    // Validate that PATH is ASSOCIATION
    if (accountPath !== "ASSOCIATION") {
      logger.error("❌ CRITICAL: Invalid PATH for association direct sync", {
        associationId: associationId,
        accountPath: accountPath,
        jobData: jobData,
      });
      throw new Error(
        `Invalid PATH for association direct sync: ${accountPath}. Expected "ASSOCIATION"`
      );
    }

    logger.info("🔄 Starting syncAssociationDirect job processing", {
      associationId: associationId,
      accountPath: accountPath,
      jobData: jobData,
    });

    try {
      logger.debug(
        `Processing syncAssociationDirect job with association ID: ${associationId}`
      );

      // Use AssociationDirectTaskProcessor for direct association processing
      const AssociationDirectTaskProcessor = require("../tasks/associationDirectTaskProcessor");
      const processor = new AssociationDirectTaskProcessor();
      await processor.process({ data: jobData });
    } catch (error) {
      logger.error("❌ Error processing syncAssociationDirect task", {
        associationId: associationId,
        accountPath: accountPath,
        error: error.message,
        stack: error.stack,
        jobData: jobData,
      });
      throw error;
    }
  };

  // Setup queue handler with base handler
  const handler = setupQueueHandler(
    syncAssociationDirect,
    "syncAssociationDirect",
    {
      processor: async (job) => {
        await processJob(job.data);
      },
      browserCleanup: true,
      notifications: {
        type: "direct_org",
        orgType: "ASSOCIATION",
        onSuccess: true,
        onFailure: true,
      },
      eventListeners: {
        failed: true,
        completed: true,
        stalled: true,
      },
      testDataSupport: true,
      queueErrorHandler: "syncAssociationDirect",
      onFailed: async (job, error) => {
        const associationId = job.data.getSync?.ID;

        // Only treat as error if it's not a stall-related error
        // Stall errors are handled by the stalled event above
        if (error.message && error.message.includes("stalled")) {
          logger.info("ℹ️ syncAssociationDirect job exceeded stall limit", {
            jobId: job.id,
            associationId: associationId,
            message:
              "Job took longer than 2 hours. This may indicate a very large association or performance issue.",
          });

          // Safety net: Resume queues even for stalled jobs
          try {
            await queueStateManager.resumeAllQueues(
              `Job stalled: syncAssociationDirect (ID: ${
                job.id
              }, Association: ${associationId || "UNKNOWN"})`
            );
          } catch (resumeError) {
            logger.error(
              "[syncAssociationDirect] Error resuming queues in stalled handler",
              { error: resumeError.message }
            );
          }

          // Log failure with prominent org ID
          if (associationId) {
            logger.error("❌ syncAssociationDirect job failed", {
              jobId: job.id,
              associationId: associationId,
              orgType: "ASSOCIATION",
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
    }
  );

  await handler(testData);
}

module.exports = handleAssociationDirectSync;
