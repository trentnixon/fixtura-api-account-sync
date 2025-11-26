const TaskProcessor = require("./taskProcessor");
const logger = require("../utils/logger");
const { Controller_ClubDirect } = require("../controller/controller");

/**
 * Task processor for direct club ID processing.
 * Processes jobs that use club ID directly (without account lookup).
 * Skips account status updates since this is direct org processing.
 */
class ClubDirectTaskProcessor extends TaskProcessor {
  async process(job) {
    try {
      const clubId = job.data?.getSync?.ID;
      const accountPath = job.data?.getSync?.PATH;

      if (!clubId) {
        logger.error("❌ CRITICAL: No club ID found in job data", {
          jobData: job.data,
        });
        throw new Error("Missing club ID in job data");
      }

      logger.info("🏢 Processing direct club task", {
        clubId: clubId,
        accountPath: accountPath,
      });

      // Process using direct club controller
      await Controller_ClubDirect(job.data);

      logger.info("✅ Successfully processed direct club task", {
        clubId: clubId,
      });

      // Note: We skip account status updates for direct ID processing
      // No isSetup update, no notifyCMSAccountSync
      // Processing completes here - Phase 4 will handle notifications differently

      return { Complete: true, clubId: clubId };
    } catch (error) {
      const clubId = job.data?.getSync?.ID;
      logger.error(
        `❌ Error processing direct club task for Club ID: ${
          clubId || "UNKNOWN"
        }: ${error.message}`,
        {
          clubId: clubId,
          orgType: "CLUB",
          jobId: job?.id,
          error: error.message,
          stack: error.stack,
          jobData: job.data,
        }
      );
      throw error;
    }
  }
}

module.exports = ClubDirectTaskProcessor;
