const cron = require("node-cron");
const fetcher = require("../utils/fetcher");
const logger = require("../utils/logger");
const taskRunnerQueue = require("../queues/taskRunnerQueue");
const { addJobToQueue } = require("../queues/queueUtils");

const taskRunnerCron = () => {
  cron.schedule(
    //"0 1 * * *"
    "*/1 * * * *",
    async () => {
      // Adjust the cron pattern as needed
      try {
        const idsList = await fetcher("account/sync");
        if (idsList && idsList.continue) {
          idsList.accountsToProcess.forEach(async (ITEM) => {
            await addJobToQueue(taskRunnerQueue, { getSync: ITEM });
          });
        } else {
          logger.info(
            "[taskRunnerCron.js] No tasks to process in taskRunnerQueue."
          );
        }
      } catch (error) {
        logger.error("[taskRunnerCron.js] Error in task runner cron job", {
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
module.exports = taskRunnerCron;
