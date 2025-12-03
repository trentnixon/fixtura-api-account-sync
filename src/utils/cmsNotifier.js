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

/**
 * Helper function to send Slack notification when a queue job starts.
 *
 * @param {string} queueName - Name of the queue
 * @param {Object} job - Bull job instance
 */
async function notifyJobStart(queueName, job) {
  try {
    const slackToken = process.env.SlackToken;
    const channel =
      process.env.SLACK_QUEUE_JOB_START_CHANNEL ||
      process.env.SLACK_QUEUE_MONITORING_CHANNEL ||
      "#queue-monitoring";

    if (!slackToken) {
      logger.debug(
        `[notifyJobStart] Slack not configured, skipping job start notification`,
        {
          queueName,
          jobId: job.id,
        }
      );
      return;
    }

    const accountId = job.data?.getSync?.ID || "N/A";
    const accountPath = job.data?.getSync?.PATH || "N/A";
    const processGameData = job.data?.getSync?.processGameData;

    // Build notification message
    const message =
      `🚀 Queue Job Started\n` +
      `• Queue: ${queueName}\n` +
      `• Job ID: ${job.id}\n` +
      `• Account/Org ID: ${accountId}\n` +
      `• Path: ${accountPath}\n` +
      (processGameData !== undefined
        ? `• Process Game Data: ${processGameData}\n`
        : "") +
      `• Timestamp: ${new Date().toISOString()}\n` +
      `• Job Data: \`\`\`${JSON.stringify(job.data, null, 2)}\`\`\``;

    try {
      const slackClient = new WebClient(slackToken);
      await slackClient.chat.postMessage({
        channel: channel,
        text: `🚀 Queue Job Started: ${queueName}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🚀 Queue Job Started: ${queueName}`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Job ID:*\n${job.id}`,
              },
              {
                type: "mrkdwn",
                text: `*Account/Org ID:*\n${accountId}`,
              },
              {
                type: "mrkdwn",
                text: `*Path:*\n${accountPath}`,
              },
              {
                type: "mrkdwn",
                text: `*Timestamp:*\n${new Date().toISOString()}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Job Data:*\n\`\`\`${JSON.stringify(job.data, null, 2)}\`\`\``,
            },
          },
        ],
      });

      logger.info(`📢 Slack notification sent for job start`, {
        queueName,
        jobId: job.id,
        accountId,
        channel,
      });
    } catch (slackError) {
      logger.error(`❌ Failed to send Slack notification for job start`, {
        queueName,
        jobId: job.id,
        error: slackError.message,
        channel,
      });
      // Don't throw - Slack failures shouldn't break job processing
    }
  } catch (error) {
    logger.error(`❌ Error in notifyJobStart`, {
      queueName,
      jobId: job?.id,
      error: error.message,
    });
    // Don't throw - notification failures shouldn't break job processing
  }
}

module.exports = {
  notifyCMSAccountSync,
  notifyDirectOrgProcessing,
  notifyJobStart,
};
