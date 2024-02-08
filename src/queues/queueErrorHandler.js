const logger = require('../utils/logger');

const queueErrorHandler = (queueName) => {
    return (job, err) => {
        logger.critical(`Error in queue ${queueName}`, {
            jobID: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
        });

        // Additional error handling logic can be added here
        // For example, send notifications, attempt job retries, etc.
    };
};

module.exports = queueErrorHandler;