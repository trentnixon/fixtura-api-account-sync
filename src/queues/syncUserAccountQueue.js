const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const { notifyCMSAccountSync } = require("../utils/cmsNotifier");
const {
  syncUserAccount,
  // startAssetBundleCreation, // COMMENTED OUT: No longer used after removing queue transitions
} = require("../config/queueConfig");

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

    syncUserAccount.process(async (job) => {
      await processJob(job.data);
    });

    // Event listeners
    syncUserAccount.on("completed", async (job, result) => {
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

      logger.info("✅ syncUserAccount job completed successfully", {
        jobId: job.id,
        accountId: accountId,
        accountPath: accountPath,
        result: result,
      });

      // Notify CMS of successful completion
      await notifyCMSAccountSync(accountId, "completed");
    });

    syncUserAccount.on("failed", async (job, error) => {
      const accountId = job.data.getSync?.ID;

      // Handle queue error
      queueErrorHandler(job, error, logger);

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

module.exports = handleAccountSync;

// Development Notes:
// - Implemented centralized logging for critical steps and outcomes, enhancing the maintainability and debugging capability.
// - Added error handling and re-throwing practices to preserve error context and facilitate proper error recovery in the queue system.
// - Included conditions to handle different task processing paths dynamically, which makes the function more scalable.
// - Recommendations for future improvements include implementing a mechanism for retrying failed jobs depending on the error type and
//   improving the handling of dynamically loaded task processors to reduce coupling and increase flexibility.

// LLM Notes:
// This module, part of a Node.js backend application, handles asynchronous job processing using a queue system managed by Bull.
// It is specifically designed to process user-related tasks that are either club-related or association-related, depending on the job's data.
// The module is located at /queues/syncUserAccount.js and interfaces with specific task processors, a logger, and an error handler to manage task execution robustly.
