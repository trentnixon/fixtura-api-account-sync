const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const { notifyDirectOrgProcessing } = require("../utils/cmsNotifier");
const { syncClubDirect } = require("../config/queueConfig");

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

  if (testData) {
    // For testing: process the test data directly
    try {
      await processJob(testData);

      logger.info("✅ syncClubDirect test data processed successfully", {
        clubId: testData.getSync?.ID,
      });
    } catch (error) {
      logger.error("❌ Error processing syncClubDirect test data", {
        clubId: testData.getSync?.ID,
        error: error.message,
      });
      throw error; // Re-throw to maintain original error behavior
    }
  } else {
    // Normal queue processing
    syncClubDirect.process(async (job) => {
      await processJob(job.data);
    });

    // Event listeners
    syncClubDirect.on("completed", async (job, result) => {
      const clubId = job.data.getSync?.ID;
      const accountPath = job.data.getSync?.PATH;

      // Validate job data before proceeding
      if (!clubId) {
        logger.error("❌ CRITICAL: No club ID found in completed job data", {
          jobId: job.id,
          jobData: job.data,
          getSync: job.data.getSync,
        });
        return;
      }

      logger.info("✅ syncClubDirect job completed successfully", {
        jobId: job.id,
        clubId: clubId,
        accountPath: accountPath,
        result: result,
      });

      // Notify via Slack/webhook (not CMS account endpoint)
      await notifyDirectOrgProcessing(clubId, "CLUB", "completed");
    });

    // Handle stalled jobs gracefully - log as info instead of error
    // Stalled jobs are normal for long-running processing (30-90 minutes)
    syncClubDirect.on("stalled", (jobId) => {
      logger.info(
        "⏳ syncClubDirect job detected as stalled (still processing)",
        {
          jobId: jobId,
          message:
            "Job is taking longer than expected but still processing. This is normal for large clubs.",
        }
      );
    });

    syncClubDirect.on("failed", async (job, error) => {
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
        return; // Don't treat as critical error, just log and return
      }

      // Handle queue error for actual failures
      queueErrorHandler("syncClubDirect")(job, error);

      // Log failure with prominent org ID
      if (clubId) {
        logger.error("❌ syncClubDirect job failed", {
          jobId: job.id,
          clubId: clubId,
          orgType: "CLUB",
          error: error.message,
          stack: error.stack,
        });

        // Notify via Slack/webhook (not CMS account endpoint)
        await notifyDirectOrgProcessing(
          clubId,
          "CLUB",
          "failed",
          error.message
        );
      } else {
        logger.error(
          "❌ No club ID available for error logging on job failure",
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

module.exports = handleClubDirectSync;
