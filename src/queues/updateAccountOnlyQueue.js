const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const UpdateAccountOnlyProcessor = require("../tasks/updateAccountOnlyProcessor");
const { notifyCMSAccountSync } = require("../utils/cmsNotifier");
const { updateAccountOnly } = require("../config/queueConfig");

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

  if (testData) {
    // For testing: process the test data directly
    try {
      await processJob(testData);

      // Notify CMS of successful completion for test data
      const accountId = testData.getSync?.ID;
      if (accountId) {
        await notifyCMSAccountSync(accountId, "completed");
      }
    } catch (error) {
      // Notify CMS of failure for test data
      const accountId = testData.getSync?.ID;
      if (accountId) {
        await notifyCMSAccountSync(accountId, "failed");
      }
      throw error; // Re-throw to maintain original error behavior
    }
  } else {
    // Normal queue processing
    updateAccountOnly.process(async (job) => {
      await processJob(job.data);
    });

    // Event listeners
    updateAccountOnly.on("completed", async (job, result) => {
      const accountId = job.data.getSync?.ID;
      const accountPath = job.data.getSync?.PATH;

      // Validate account data before proceeding
      if (!accountId) {
        logger.error("❌ CRITICAL: No account ID found in completed job data", {
          jobId: job.id,
          jobData: job.data,
          getSync: job.data.getSync,
        });
        return;
      }

      logger.info("✅ updateAccountOnly job completed successfully", {
        jobId: job.id,
        accountId: accountId,
        accountPath: accountPath,
        result: result,
      });

      // Notify CMS of successful completion (backup notification)
      // Note: Processor also notifies CMS, but this ensures notification even if processor doesn't
      await notifyCMSAccountSync(accountId, "completed");
    });

    updateAccountOnly.on("failed", async (job, error) => {
      const accountId = job.data.getSync?.ID;

      // Handle queue error
      queueErrorHandler("updateAccountOnly")(job, error);

      // Notify CMS of failure if accountId is available
      if (accountId) {
        await notifyCMSAccountSync(accountId, "failed");
      } else {
        logger.error(
          "❌ No account ID available for CMS notification on job failure",
          {
            jobId: job.id,
            jobData: job.data,
          }
        );
      }
    });
  }
}

module.exports = handleUpdateAccountOnly;
