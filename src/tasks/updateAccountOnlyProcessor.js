const TaskProcessor = require("./taskProcessor");
const logger = require("../utils/logger");
const {
  Controller_Club,
  Controller_Associations,
} = require("../controller/controller");
const { notifyCMSAccountSync } = require("../utils/cmsNotifier");
const fetcher = require("../utils/fetcher");

/**
 * Processor for on-demand account updates.
 * Performs full sync (competitions, teams, games, data collections) without handoff to another worker.
 */
class UpdateAccountOnlyProcessor extends TaskProcessor {
  async process(job) {
    const accountId = job.data?.getSync?.ID || job.data?.ID;
    const accountPath = job.data?.getSync?.PATH || job.data?.PATH;

    if (!accountId) {
      logger.error("❌ CRITICAL: No account ID found in job data", {
        jobData: job.data,
      });
      throw new Error("Missing account ID in job data");
    }

    try {
      logger.info("🔄 Starting updateAccountOnly job processing", {
        accountId: accountId,
        accountPath: accountPath,
      });

      // Set isUpdating flag to true when job starts
      await fetcher(`accounts/${accountId}`, "PUT", {
        data: { isUpdating: true },
      });
      logger.info(`Set isUpdating to true for account ${accountId}`);

      // Route to appropriate controller based on account type
      if (accountPath === "CLUB") {
        logger.info("🏢 Processing CLUB account", { accountId: accountId });
        await Controller_Club(job.data);
      } else if (accountPath === "ASSOCIATION") {
        logger.info("🏛️ Processing ASSOCIATION account", {
          accountId: accountId,
        });
        await Controller_Associations(job.data);
      } else {
        logger.error("❌ Unknown account path", {
          accountId: accountId,
          accountPath: accountPath,
          jobData: job.data,
        });
        throw new Error(`Unknown account path: ${accountPath}`);
      }

      logger.info("✅ Successfully processed updateAccountOnly task", {
        accountId: accountId,
        accountPath: accountPath,
      });

      // Set isUpdating flag to false when job completes successfully
      await fetcher(`accounts/${accountId}`, "PUT", {
        data: { isUpdating: false },
      });
      logger.info(`Set isUpdating to false for account ${accountId}`);

      // Notify CMS of successful completion
      await notifyCMSAccountSync(accountId, "completed");

      return { Complete: true, accountId: accountId };
    } catch (error) {
      logger.error("❌ Error processing updateAccountOnly task", {
        accountId: accountId,
        accountPath: accountPath,
        error: error.message,
        stack: error.stack,
        jobData: job.data,
      });

      // Set isUpdating flag to false on error
      try {
        await fetcher(`accounts/${accountId}`, "PUT", {
          data: { isUpdating: false },
        });
        logger.info(
          `Set isUpdating to false for account ${accountId} (error recovery)`
        );
      } catch (updateError) {
        logger.error(
          `Failed to set isUpdating to false for account ${accountId}`,
          { error: updateError.message }
        );
      }

      // Notify CMS of failure
      await notifyCMSAccountSync(accountId, "failed");

      throw error;
    }
  }
}

module.exports = UpdateAccountOnlyProcessor;
