const fetcher = require("./fetcher");
const logger = require("./logger");

/**
 * Helper function to notify CMS about account sync completion/failure
 */
async function notifyCMSAccountSync(accountId, status) {
  try {
    logger.info(`🔄 Attempting to notify CMS of account sync ${status}`, {
      accountId: accountId,
      endpoint: `account/AccountSchedulerToFalse/${accountId}`,
      method: "GET",
    });

    await fetcher(`account/AccountSchedulerToFalse/${accountId}`, "GET", {});

    logger.info(`✅ CMS notified of account sync ${status}`, {
      accountId: accountId,
      status: status,
    });
  } catch (error) {
    logger.error(`❌ Failed to notify CMS of account sync ${status}`, {
      accountId: accountId,
      status: status,
      error: error.message,
      endpoint: `account/AccountSchedulerToFalse/${accountId}`,
    });
  }
}

module.exports = { notifyCMSAccountSync };
