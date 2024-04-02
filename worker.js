/* const dotenv = require("dotenv");
dotenv.config(); */

const { ENVIRONMENT } = require("./src/config/environment");
const { QUEUE_CONFIG } = require("./src/config/queueConfig");
const accountInitQueue = require("./src/queues/accountInitQueue");
const taskRunnerQueue = require("./src/queues/taskRunnerQueue");
const accountInitCron = require("./src/cronJobs/accountInitCron");
const taskRunnerCron = require("./src/cronJobs/taskRunnerCron");
const logger = require("./src/utils/logger");

// Validate environment configuration
if (!QUEUE_CONFIG[ENVIRONMENT]) {
  throw new Error(
    `Unsupported NODE_ENV: "${ENVIRONMENT}". Supported environments are: ${Object.keys(
      QUEUE_CONFIG
    ).join(", ")}`
  ); 
}
logger.info(`Worker starting in ${ENVIRONMENT} mode.`);

// Initialize queues
accountInitQueue;  
taskRunnerQueue;

// Start cron jobs
accountInitCron();
taskRunnerCron();

logger.info("Worker started successfully.");
