// Internal Cron tasks

// Queued processing Tasks
const checkAssetGeneratorAccountStatus = require("./src/queues/checkAssetGeneratorAccountStatus");
const handleAccountSync = require("./src/queues/syncUserAccountQueue");

const logger = require("./src/utils/logger");
const onboardNewAccountTask = require("./src/queues/onboardNewAccount");

// Integration Test Runner
const IntegrationTestRunner = require("./__tests__/integration/cronScheduler");

function initializeQueueProcessing() {
  console.log("=== WORKER STARTUP DEBUG ===");
  console.log(
    "checkAssetGeneratorAccountStatus function:",
    typeof checkAssetGeneratorAccountStatus
  );
  console.log("onboardNewAccountTask function:", typeof onboardNewAccountTask);

  console.log("=== INITIALIZING QUEUE PROCESSING ===");

  try {
    console.log("Calling checkAssetGeneratorAccountStatus...");
    checkAssetGeneratorAccountStatus();
    console.log("checkAssetGeneratorAccountStatus completed");
  } catch (error) {
    console.error("Error in checkAssetGeneratorAccountStatus:", error);
  }

  /*   const testData = {
    getSync: {
      PATH: "ASSOCIATION",
      ID: 427,
      continue: true,
      FirstName: "ADMIN",
    },
  };
 */
  //  handleAccountSync(testData);
  // run account Sync as set by Strapi
  // uncomment this before
  try {
    console.log("Calling handleAccountSync...");
    handleAccountSync();
    console.log("handleAccountSync completed");
  } catch (error) {
    console.error("Error in handleAccountSync:", error);
  }

  try {
    console.log("Calling onboardNewAccountTask...");
    onboardNewAccountTask();
    console.log("onboardNewAccountTask completed");
  } catch (error) {
    console.error("Error in onboardNewAccountTask:", error);
  }

  console.log("=== QUEUE PROCESSING INITIALIZATION COMPLETE ===");
}

function initializeIntegrationTests() {
  console.log("=== INITIALIZING INTEGRATION TESTS ===");

  try {
    console.log("Starting integration test runner...");
    const runner = new IntegrationTestRunner();
    runner.startRunner();
    console.log("Integration test runner started successfully");
  } catch (error) {
    console.error("Error starting integration test runner:", error);
  }

  console.log("=== INTEGRATION TESTS INITIALIZATION COMPLETE ===");
}

// Start Processors
initializeQueueProcessing();

// Start Integration Tests
initializeIntegrationTests();

logger.info("Worker started successfully.");
