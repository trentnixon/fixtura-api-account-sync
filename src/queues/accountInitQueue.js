const Queue = require("bull");
const { ENVIRONMENT } = require("../config/environment");
const { QUEUE_CONFIG } = require("../config/queueConfig");
const queueErrorHandler = require("./queueErrorHandler");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const logger = require("../utils/logger"); // Ensure the path is correct

const accountInitQueue = new Queue(  
  QUEUE_CONFIG[ENVIRONMENT].accountInit,
  process.env.REDISCLOUD_URL // or your Redis configuration
);

accountInitQueue.process(async (job) => {
  try {
    const { PATH, ID } = job.data.getSync; 
    if (PATH === "CLUB") {
      const clubProcessor = new ClubTaskProcessor();
      await clubProcessor.process(job); 
    } else {
      const associationProcessor = new AssociationTaskProcessor();
      await associationProcessor.process(job); 
    }
    logger.info(`Successfully processed account Init for a ${PATH} with ID: ${ID}`);
  } catch (error) {
    logger.error(
      `Error processing job ${job.id} in accountInitQueue: ${error.message}`,
      {
        jobData: job.data,
        error: error,
      }
    );
  }
});

accountInitQueue.on("failed", queueErrorHandler("accountInit"));

module.exports = accountInitQueue;
