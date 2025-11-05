// initializeQueues.js
const Queue = require("bull");
const getRedisClient = require("./redisConfig"); // Ensure this path is correct and config is correctly setting up Redis
const Redis = require("ioredis");

function createSharedClient(type) {
  return getRedisClient(type);
}

const queueNames = {
  // 1 Sync Account on Bundle Create
  startAssetBundleCreation: "startAssetBundleCreation",
  // 2 send ID to Results Sync
  setSyncAccountFixtures: "setSyncAccountFixtures",
  // 3 Account Sync on Internal Cron
  syncUserAccount: "syncUserAccount",
  // 4 onboarding
  onboardNewAccount: "onboardNewAccount",
  // 5 On-demand account update only (no data processing)
  updateAccountOnly: "updateAccountOnly",
};

let initializedQueues;

function initializeQueues() {
  if (!initializedQueues) {
    initializedQueues = {};
    Object.keys(queueNames).forEach((key) => {
      initializedQueues[key] = new Queue(queueNames[key], {
        createClient: (type) => createSharedClient(type),
      });
    });
  }
  return initializedQueues;
}

module.exports = initializeQueues(); // Make sure this call happens here so it executes and exports the queues.
