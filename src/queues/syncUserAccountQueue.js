const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const { syncUserAccount } = require("../config/queueConfig");

/**
 * Function to synchronize user accounts by processing tasks from the queue.
 * Handles specific tasks based on the type (club or association).
 */
async function handleAccountSync(testData = null) {
  const processJob = async jobData => {
    try {
      const { PATH, ID } = jobData.getSync;
      logger.debug(`Start processing job with ID: ${ID} on path: ${PATH}`);

      if (PATH === "CLUB") {
        const clubProcessor = new ClubTaskProcessor();
        await clubProcessor.process({ data: jobData });
      } else if (PATH === "ASSOCIATION") {
        const associationProcessor = new AssociationTaskProcessor();
        await associationProcessor.process({ data: jobData });
      }

      logger.info(`Successfully processed task for ID: ${ID}`);
    } catch (error) {
      logger.error(
        `Error processing task for ID: ${jobData.getSync.ID}: ${error.message}`,
        {
          jobData,
          errorStack: error.stack,
        }
      );
      throw error;
    }
  };

  if (testData) {
    // For testing: process the test data directly
    await processJob(testData);
  } else {
    // Normal queue processing
    syncUserAccount.process(async job => {
      await processJob(job.data);
    });

    // Event listeners
    syncUserAccount.on("completed", (job, result) => {
      logger.info(
        `Job ${job.id} completed successfully for account ${job.data.getSync.ID}`
      );
    });

    syncUserAccount.on("failed", (job, error) => {
      queueErrorHandler(job, error, logger);
    });
  }
}

module.exports = handleAccountSync;

// Development Notes:
// - Implemented centralized logging for critical steps and outcomes, enhancing the maintainability and debugging capability.
// - Added error handling and re-throwing practices to preserve error context and facilitate proper error recovery in the queue system.
// - Included conditions to handle different task processing paths dynamically, which makes the function more scalable.
// - Recommendations for future improvements include implementing a mechanism for retrying failed jobs depending on the error type and
//   improving the handling of dynamically loaded task processors to reduce coupling and increase flexibility.

// LLM Notes:
// This module, part of a Node.js backend application, handles asynchronous job processing using a queue system managed by Bull.
// It is specifically designed to process user-related tasks that are either club-related or association-related, depending on the job's data.
// The module is located at /queues/syncUserAccount.js and interfaces with specific task processors, a logger, and an error handler to manage task execution robustly.
