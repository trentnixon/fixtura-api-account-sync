const Queue = require("bull");
const { ENVIRONMENT } = require("../config/environment");
const { QUEUE_CONFIG } = require("../config/queueConfig");
const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");

const taskRunnerQueue = new Queue(
  QUEUE_CONFIG[ENVIRONMENT].taskRunner,
  process.env.REDISCLOUD_URL // or your Redis configuration
);

taskRunnerQueue.process(async (job) => {
  try {
    const { PATH, ID } = job.data.getSync; // Ensure this matches the structure of your job data

    if (PATH === "CLUB") {
      console.log("process CLUB"); 
     const clubProcessor = new ClubTaskProcessor();
      await clubProcessor.process(job); 
    } else {
      console.log("process Association");
      const associationProcessor = new AssociationTaskProcessor();
      await associationProcessor.process(job);
    }

    logger.info(`Successfully processed taskRunner for ID: ${ID}`);
  } catch (error) {
    logger.error(
      `Error processing taskRunner for ID: ${ID}: ${error.message}`,
      {
        jobData: job.data,
        error: error,
      }
    );
    throw error; // Or handle the error based on your application's needs
  }
});

taskRunnerQueue.on("failed", queueErrorHandler("taskRunner"));

module.exports = taskRunnerQueue;
