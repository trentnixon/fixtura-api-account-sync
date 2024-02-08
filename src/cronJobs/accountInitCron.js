const cron = require('node-cron');
const fetcher = require('../utils/fetcher');
const logger = require('../utils/logger');
//const accountInitQueue = require('../queues/accountInitQueue'); 
const { addJobToQueue } = require('../queues/queueUtils');
const taskRunnerQueue = require('../queues/taskRunnerQueue');

const accountInitCron = () => { 
  cron.schedule('*/1 * * * *', async () => {
    try {
      const getSync = await fetcher("account/AccountInit");
      console.log("accountInitCron", getSync)
      if (getSync && getSync.continue) {
        await addJobToQueue(taskRunnerQueue, { getSync: getSync }); 
      
      } else {
        logger.info("[accountInitCron.js] No accountInit jobs to queue.");
      }
    } catch (error) {
      logger.error("[accountInitCron.js] Error in accountInit cron job", {
        errorMessage: error.message,
        errorStack: error.stack,
        errorDetails: error
      });
    }
  }, {
    scheduled: true,
    timezone: "Australia/Sydney"
  });
};

module.exports = accountInitCron;