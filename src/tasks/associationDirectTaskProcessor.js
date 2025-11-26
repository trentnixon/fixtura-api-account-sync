const TaskProcessor = require("./taskProcessor");
const logger = require("../utils/logger");
const { Controller_AssociationDirect } = require("../controller/controller");

/**
 * Task processor for direct association ID processing.
 * Processes jobs that use association ID directly (without account lookup).
 * Skips account status updates since this is direct org processing.
 */
class AssociationDirectTaskProcessor extends TaskProcessor {
  async process(job) {
    try {
      const associationId = job.data?.getSync?.ID;
      const accountPath = job.data?.getSync?.PATH;

      if (!associationId) {
        logger.error("❌ CRITICAL: No association ID found in job data", {
          jobData: job.data,
        });
        throw new Error("Missing association ID in job data");
      }

      logger.info("🏛️ Processing direct association task", {
        associationId: associationId,
        accountPath: accountPath,
      });

      // Process using direct association controller
      await Controller_AssociationDirect(job.data);

      logger.info("✅ Successfully processed direct association task", {
        associationId: associationId,
      });

      // Note: We skip account status updates for direct ID processing
      // No isSetup update, no notifyCMSAccountSync
      // Processing completes here - Phase 4 will handle notifications differently

      return { Complete: true, associationId: associationId };
    } catch (error) {
      const associationId = job.data?.getSync?.ID;
      logger.error(
        `❌ Error processing direct association task for Association ID: ${
          associationId || "UNKNOWN"
        }: ${error.message}`,
        {
          associationId: associationId,
          orgType: "ASSOCIATION",
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

module.exports = AssociationDirectTaskProcessor;
