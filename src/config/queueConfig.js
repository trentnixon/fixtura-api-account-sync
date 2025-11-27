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
  // 6 Direct club processing (bypasses account lookup)
  syncClubDirect: "syncClubDirect",
  // 7 Direct association processing (bypasses account lookup)
  syncAssociationDirect: "syncAssociationDirect",
};

let initializedQueues;

function initializeQueues() {
  if (!initializedQueues) {
    initializedQueues = {};
    Object.keys(queueNames).forEach((key) => {
      // Default queue options
      const defaultOptions = {
        createClient: (type) => createSharedClient(type),
      };

      // Special timeout settings for long-running direct processing queues
      // These queues process full data pipelines (competitions, teams, games, validation)
      // and can take 30-90 minutes for large organizations
      if (key === "syncAssociationDirect" || key === "syncClubDirect") {
        defaultOptions.settings = {
          // How often Bull checks for stalled jobs (5 minutes = 300000ms)
          // Association/club processing can take 30-90 minutes, so we need a longer interval
          // to prevent false positives where jobs are still processing but marked as stalled
          stalledInterval: 300000, // Check for stalled jobs every 5 minutes (instead of default 30 seconds)
          maxStalledCount: 24, // Allow 24 stalled checks before failing (24 * 5min = 2 hours max)
        };
        // Job options for retry and cleanup
        defaultOptions.defaultJobOptions = {
          removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 100, // Keep last 100 completed jobs
          },
          removeOnFail: {
            age: 604800, // Keep failed jobs for 7 days
            count: 500, // Keep last 500 failed jobs
          },
          attempts: 3, // Retry failed jobs up to 3 times
          backoff: {
            type: "exponential",
            delay: 60000, // Start with 1 minute delay, then exponential backoff
          },
        };
      }

      initializedQueues[key] = new Queue(queueNames[key], defaultOptions);
    });
  }
  return initializedQueues;
}

module.exports = initializeQueues(); // Make sure this call happens here so it executes and exports the queues.
