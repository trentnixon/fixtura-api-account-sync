const TaskProcessor = require("./taskProcessor");
const logger = require("../utils/logger");

const { Controller_Club } = require("../controller/controller");
const fetcher = require("../utils/fetcher");

class ClubTaskProcessor extends TaskProcessor {
  async process(job) {
    try {
      //console.log("ClubTaskProcessor", job.data)
      await Controller_Club(job.data);

      // Update the account's setup status
      console.log(
        "ClubTaskProcessor COMPLETED Set isSet up to TRUE",
        job.data.getSync
      );
      await fetcher(`accounts/${job.data.getSync.ID}`, "PUT", {
        data: { isSetup: true },
      });


      logger.info(
        `Successfully processed onboardNewAccount for ID: ${job.data.getSync.ID}`
      );
    } catch (error) {
      logger.error(
        `Error processing club task for ID: ${job.data.getSync.ID}: ${error.message}`,
        {
          job,
          error: error,
        }
      );
      throw error; // Or handle the error as per your application's needs
    }
  }
}

module.exports = ClubTaskProcessor;
