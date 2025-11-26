const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const { notifyDirectOrgProcessing } = require("../utils/cmsNotifier");
const { syncAssociationDirect } = require("../config/queueConfig");

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

  if (testData) {
    // For testing: process the test data directly
    try {
      await processJob(testData);

      logger.info("✅ syncAssociationDirect test data processed successfully", {
        associationId: testData.getSync?.ID,
      });
    } catch (error) {
      logger.error("❌ Error processing syncAssociationDirect test data", {
        associationId: testData.getSync?.ID,
        error: error.message,
      });
      throw error; // Re-throw to maintain original error behavior
    }
  } else {
    // Normal queue processing
    syncAssociationDirect.process(async (job) => {
      await processJob(job.data);
    });

    // Event listeners
    syncAssociationDirect.on("completed", async (job, result) => {
      const associationId = job.data.getSync?.ID;
      const accountPath = job.data.getSync?.PATH;

      // Validate job data before proceeding
      if (!associationId) {
        logger.error(
          "❌ CRITICAL: No association ID found in completed job data",
          {
            jobId: job.id,
            jobData: job.data,
            getSync: job.data.getSync,
          }
        );
        return;
      }

      logger.info("✅ syncAssociationDirect job completed successfully", {
        jobId: job.id,
        associationId: associationId,
        accountPath: accountPath,
        result: result,
      });

      // Notify via Slack/webhook (not CMS account endpoint)
      await notifyDirectOrgProcessing(
        associationId,
        "ASSOCIATION",
        "completed"
      );
    });

    syncAssociationDirect.on("failed", async (job, error) => {
      const associationId = job.data.getSync?.ID;

      // Handle queue error
      queueErrorHandler("syncAssociationDirect")(job, error);

      // Log failure with prominent org ID
      if (associationId) {
        logger.error("❌ syncAssociationDirect job failed", {
          jobId: job.id,
          associationId: associationId,
          orgType: "ASSOCIATION",
          error: error.message,
          stack: error.stack,
        });

        // Notify via Slack/webhook (not CMS account endpoint)
        await notifyDirectOrgProcessing(
          associationId,
          "ASSOCIATION",
          "failed",
          error.message
        );
      } else {
        logger.error(
          "❌ No association ID available for error logging on job failure",
          {
            jobId: job.id,
            jobData: job.data,
            error: error.message,
            stack: error.stack,
          }
        );
      }
    });
  }
}

module.exports = handleAssociationDirectSync;
