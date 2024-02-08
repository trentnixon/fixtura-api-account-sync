const TaskProcessor = require("./TaskProcessor");
const logger = require("../utils/logger");
const fetcher = require("../utils/fetcher");
const { Controller_Associations } = require("../controller/controller");

class AssociationTaskProcessor extends TaskProcessor {
  async process(job) {
    try {
      //console.log("AssociationTaskProcessor", job.data);
      await Controller_Associations(job.data);

      // Update the account's setup status
      console.log("AssociationTaskProcessor COMPLETED Set isSet up to TRUE", job.data.getSync)
       await fetcher(`accounts/${job.data.getSync.ID}`, "PUT", {
        data: { isSetup: true },  
      });
      logger.info(
        `Successfully processed association task for ID: ${job.data.getSync.ID}`
      );
    } catch (error) {
      logger.error(
        `Error processing association task for ID: ${job.data.getSync.ID}: ${error.message}`,
        {
          job,
          error: error,
        }
      );
      throw error; // Or handle the error as per your application's needs
    }
  }
}

module.exports = AssociationTaskProcessor;
