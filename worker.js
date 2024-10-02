// Internal Cron tasks

// Queued processing Tasks
const checkAssetGeneratorAccountStatus = require("./src/queues/checkAssetGeneratorAccountStatus");
const handleAccountSync = require("./src/queues/syncUserAccountQueue");

const logger = require("./src/utils/logger");
const onboardNewAccountTask = require("./src/queues/onboardNewAccount");

function initializeQueueProcessing() {
  // Check Data sync for Asset Bundlers
  checkAssetGeneratorAccountStatus();

  // run account Sync as set by Strapi
  // uncomment this before pushing
  handleAccountSync();
  const testData = {
    getSync: {
      PATH: "ASSOCIATION",
      ID: "194",
    },
  };
  handleAccountSync(testData);

  onboardNewAccountTask();
}

// Start Processors
initializeQueueProcessing();

logger.info("Worker started successfully.");

// TODO!! SET UP ADN TEST THE OnBOARDING REDIS HOOK UP
/* function startCronJobs() {
  //taskCronSyncUserAccounts();
  // OnBoarding Cron Removed and handled in Strapi
} */

// Start cron jobs
//startCronJobs();
