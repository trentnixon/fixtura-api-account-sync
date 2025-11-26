const fetcher = require("./fetcher");
const logger = require("./logger");
const { WebClient } = require("@slack/web-api");

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

/**
 * Helper function to notify about direct org processing completion/failure.
 * Sends notification via Slack/webhook (not CMS account endpoint).
 *
 * @param {number} orgId - The organization ID (club or association ID)
 * @param {string} orgType - The organization type ("CLUB" or "ASSOCIATION")
 * @param {string} status - The status ("completed" or "failed")
 * @param {string} errorMessage - Optional error message for failures
 */
async function notifyDirectOrgProcessing(
  orgId,
  orgType,
  status,
  errorMessage = null
) {
  try {
    const slackToken = process.env.SlackToken;
    const channel =
      status === "failed"
        ? process.env.SLACK_DIRECT_ORG_ERROR_CHANNEL || "#data-account-error"
        : process.env.SLACK_DIRECT_ORG_CHANNEL || "#data-account";

    // Build notification message
    const emoji = status === "completed" ? "✅" : "❌";
    const statusText =
      status === "completed" ? "completed successfully" : "failed";
    const message =
      `${emoji} Direct ${orgType} Processing ${statusText}\n` +
      `• Organization ID: ${orgId}\n` +
      `• Organization Type: ${orgType}\n` +
      (errorMessage ? `• Error: ${errorMessage}\n` : "") +
      `• Timestamp: ${new Date().toISOString()}`;

    // Send to Slack if token is configured
    if (slackToken) {
      try {
        const slackClient = new WebClient(slackToken);
        await slackClient.chat.postMessage({
          channel: channel,
          text: message,
        });
        logger.info(
          `📢 Slack notification sent for direct ${orgType} processing`,
          {
            orgId: orgId,
            orgType: orgType,
            status: status,
            channel: channel,
          }
        );
      } catch (slackError) {
        logger.error(
          `❌ Failed to send Slack notification for direct org processing`,
          {
            orgId: orgId,
            orgType: orgType,
            status: status,
            error: slackError.message,
          }
        );
      }
    } else {
      logger.info(
        `📢 Direct ${orgType} processing ${statusText} (Slack not configured)`,
        {
          orgId: orgId,
          orgType: orgType,
          status: status,
          message: message,
        }
      );
    }

    // Log notification attempt
    logger.info(`📢 Direct org processing notification sent`, {
      orgId: orgId,
      orgType: orgType,
      status: status,
      slackConfigured: !!slackToken,
    });
  } catch (error) {
    logger.error(`❌ Failed to send direct org processing notification`, {
      orgId: orgId,
      orgType: orgType,
      status: status,
      error: error.message,
    });
  }
}

module.exports = { notifyCMSAccountSync, notifyDirectOrgProcessing };
