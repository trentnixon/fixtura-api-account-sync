const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const { onboardNewAccount } = require("../config/queueConfig");
const setupQueueHandler = require("./baseQueueHandler");

async function onboardNewAccountTask() {
  // Setup queue handler with base handler
  const handler = setupQueueHandler(onboardNewAccount, "onboardNewAccount", {
    processor: async (job) => {
      console.log("OnBoarding Account", job.data.getSync);

      const { PATH, ID } = job.data.getSync;
      if (PATH === "CLUB") {
        const clubProcessor = new ClubTaskProcessor();
        await clubProcessor.process(job);
      } else {
        const associationProcessor = new AssociationTaskProcessor();
        await associationProcessor.process(job);
      }
      logger.info(
        `Successfully processed account Init for a ${PATH} with ID: ${ID}`
      );
    },
    browserCleanup: true,
    notifications: {
      type: "email",
      onSuccess: true,
      onFailure: false, // Email notifications typically only sent on success
    },
    eventListeners: {
      failed: false, // Currently commented out in original
      completed: false,
      stalled: false,
    },
    testDataSupport: false,
    queueErrorHandler: null,
  });

  await handler();
}

module.exports = onboardNewAccountTask;
