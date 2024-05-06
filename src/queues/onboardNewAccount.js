const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const logger = require("../utils/logger");
const { onboardNewAccount } = require("../config/queueConfig");
const fetcher = require("../utils/fetcher");
// IS THIS FOR ONBOARDING??
//onboardNewAccount

async function onboardNewAccountTask() {
  onboardNewAccount.process(async (job) => {
    try {
      console.log("OnBoarding Account", job.data.getSync);

      const { PATH, ID } = job.data.getSync;
      if (PATH === "CLUB") {
        const clubProcessor = new ClubTaskProcessor();
        await clubProcessor.process(job);
        // send Email  notification to User
        await fetcher(`account/setCompleteEmail/${job.data.getSync.ID}`, "GET");
      } else {
        const associationProcessor = new AssociationTaskProcessor();
        await associationProcessor.process(job);
         // send Email  notification to User
         await fetcher(`account/setCompleteEmail/${job.data.getSync.ID}`, "GET");
      }
      logger.info(
        `Successfully processed account Init for a ${PATH} with ID: ${ID}`
      );
    } catch (error) {
      logger.error(
        `Error processing job ${job.id} in onboardNewAccount: ${error.message}`,
        {
          jobData: job.data,
          error: error,
        }
      );
    }
  });

  /* onboardNewAccount.on("failed", queueErrorHandler("onboardNewAccount")); */
}

module.exports = onboardNewAccountTask;
