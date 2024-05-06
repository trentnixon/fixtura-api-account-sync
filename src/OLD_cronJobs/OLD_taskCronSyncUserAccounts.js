const cron = require("node-cron");
const fetcher = require("../utils/fetcher");
const logger = require("../utils/logger");
const {syncUserAccount} = require("../config/queueConfig")
const { addJobToQueue } = require("../queues/queueUtils");

const taskCronSyncUserAccounts = () => {
  cron.schedule(
    // "0 1 * * *"
    //"*/1 * * * *",
    "0 1 * * *",
    async () => {
      // Adjust the cron pattern as needed 
      try {
        const idsList = await fetcher("account/sync");
        if (idsList && idsList.continue) {
          idsList.accountsToProcess.forEach(async (ITEM) => {
            await addJobToQueue(syncUserAccount, { getSync: ITEM });
          });
        } else {
          logger.info(
            "[taskCronSyncUserAccounts.js] No tasks to process in syncUserAccount."
          );
        }
      } catch (error) {
        logger.error("[taskCronSyncUserAccounts.js] Error in task runner cron job", {
          errorMessage: error.message,
          errorStack: error.stack,
          errorDetails: error,
        });
      }
    },
    {
      scheduled: true,
      timezone: "Australia/Sydney", // Adjust timezone as needed
    }
  );
};
module.exports = taskCronSyncUserAccounts;
