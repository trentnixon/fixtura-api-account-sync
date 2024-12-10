// Internal Cron tasks

// Queued processing Tasks
const checkAssetGeneratorAccountStatus = require("./src/queues/checkAssetGeneratorAccountStatus");
const handleAccountSync = require("./src/queues/syncUserAccountQueue");

const logger = require("./src/utils/logger");
const onboardNewAccountTask = require("./src/queues/onboardNewAccount");

function initializeQueueProcessing() {
  // Check Data sync for Asset Bundlers
  checkAssetGeneratorAccountStatus();

  const testData = {
    getSync: {
      PATH: "CLUB",
      ID: 107,
      continue: true,
      FirstName: "Shayne Loughnan",
    },
  };

  handleAccountSync(testData);
  // run account Sync as set by Strapi
  // uncomment this before
  //handleAccountSync();
  onboardNewAccountTask();
}

// Start Processors
initializeQueueProcessing();

logger.info("Worker started successfully.");
