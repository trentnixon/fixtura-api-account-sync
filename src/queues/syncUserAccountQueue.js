const queueErrorHandler = require("./queueErrorHandler");
const logger = require("../utils/logger");
const ClubTaskProcessor = require("../tasks/clubTaskProcessor");
const AssociationTaskProcessor = require("../tasks/associationTaskProcessor");
const { syncUserAccount } = require("../config/queueConfig");

/**
 * Function to synchronize user accounts by processing tasks from the queue.
 * Handles specific tasks based on the type (club or association).
 */
async function handleAccountSync() {
  // Registering the processing function for the queue
  syncUserAccount.process(async (job) => {
    try {
      const { PATH, ID } = job.data.getSync; // Extracts necessary data from job
      logger.debug(`Start processing job with ID: ${ID} on path: ${PATH}`);

      // Decision structure to process different types of tasks
      if (PATH === "CLUB") {
        const clubProcessor = new ClubTaskProcessor();
        await clubProcessor.process(job);
      } else if (PATH === "ASSOCIATION") {
        const associationProcessor = new AssociationTaskProcessor();
        await associationProcessor.process(job);
      }

      logger.info(`Successfully processed task for ID: ${ID}`);
    } catch (error) {
      // Logs detailed error message and stack for debugging
      logger.error(`Error processing task for ID: ${ID}: ${error.message}`, {
        jobData: job.data,
        errorStack: error.stack,
      });
      throw error; // Re-throws the error to be caught by the queue's error handler
    }
  });

  // Event listener for successful job completion
  syncUserAccount.on("completed", (job, result) => {
    logger.info(
      `Job ${job.id} completed successfully for account ${job.data.getSync.ID}`
    );
  });

  // Event listener for failed jobs, utilizes a custom error handler
  syncUserAccount.on("failed", (job, error) => {
    queueErrorHandler(job, error, logger);
  });
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
