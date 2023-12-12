/*
AI PROMPT 

Lets Refactor the following class, function, or component, adhere to SOLID principles, robust error handling, and efficient management of large and long-term memory storage for maintainability, scalability, and seamless integration within the system.

*/

// 1. Imports & Configurations
const dotenv = require("dotenv");
const cron = require("node-cron");
const { Controller_Club, Controller_Associations } = require("./controller");
const fetcher = require("./api/Utils/fetcher");
const logger = require("./api/Utils/logger");
const Queue = require("bull");

dotenv.config();
const ENVIRONMENT = (process.env.NODE_ENV || "").trim();
console.log("Processed NODE_ENV:", ENVIRONMENT);

const QUEUE_CONFIG = {
  development: {
    taskRunner: "taskRunnerDev",
    accountInit: "accountInitDev",
  },
  production: {
    taskRunner: "taskRunner",
    accountInit: "accountInit",
  },
};

if (!QUEUE_CONFIG[ENVIRONMENT]) {
  throw new Error(
    `Unsupported NODE_ENV: "${ENVIRONMENT}". Supported environments are: ${Object.keys(
      QUEUE_CONFIG
    ).join(", ")}`
  );
}

// 2. Queue Configurations & Error Handling
const errorHandler = (queueName) => {
  return (job, err) => {
    logger.critical(`An error occurred on ${queueName}`, {
      file: "worker.js",
      function: `${queueName}JobProcessing`,
      jobID: job.id,
      jobData: job.data,
      error: err,
    });
  };
};

// 3. AccountInit Queue
const accountInitQueue = new Queue(
  QUEUE_CONFIG[ENVIRONMENT].accountInit,
  process.env.REDISCLOUD_URL
);

accountInitQueue.process(async (job) => {
  const getSync = job.data;
  try {
    if (getSync.PATH === "CLUB") {
      await Controller_Club(getSync);
    } else {
      await Controller_Associations(getSync);
    }

    // Update the account's setup status
    await fetcher(`accounts/${getSync.ID}`, "PUT", {
      data: { isSetup: true },
    });

    logger.info(`Successfully processed accountInit for ID: ${getSync.ID}`);
  } catch (error) {
    logger.error(`Error processing accountInit for ID: ${getSync.ID}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
});

accountInitQueue.on("failed", errorHandler("accountInit"));

cron.schedule(
  "*/1 * * * *",
  async () => {
    try {
      const getSync = await fetcher("account/AccountInit");
      if (getSync && getSync.continue) {
        accountInitQueue.add(getSync);
      } else {
        console.log("No accountInit jobs to queue.");
      }
    } catch (error) {
      logger.error("Error in accountInit cron job", {
        error: error.message,
        stack: error.stack,
      });
    }
  },
  { timezone: "Australia/Sydney" }
);

// TaskRunner Queue
const taskRunnerQueue = new Queue(
  QUEUE_CONFIG[ENVIRONMENT].taskRunner,
  process.env.REDISCLOUD_URL
);
taskRunnerQueue.process(async (job) => {
  const getSync = job.data.getSync;
  try {
    if (getSync.PATH === "CLUB") {
      await Controller_Club(getSync);
    } else {
      await Controller_Associations(getSync);
    }
    logger.info(`Successfully processed taskRunner for ID: ${getSync.ID}`);
  } catch (error) {
    logger.error(`Error processing taskRunner for ID: ${getSync.ID}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
});

taskRunnerQueue.on("failed", errorHandler("taskRunner"));

cron.schedule(
  "*/30 * * * *",
  async () => {
    try {
      const idsList = await fetcher("account/sync");
      idsList.forEach((ITEM) => taskRunnerQueue.add({ getSync: ITEM }));
    } catch (error) {
      logger.error("Error in taskRunner cron job", {
        error: error.message,
        stack: error.stack,
      });
    }
  },
  {
    timezone: "Australia/Sydney",
  }
);

async function testTaskRunnerQueue() {
  console.log(`Manually triggering taskRunnerQueue for testing in ${ENVIRONMENT} MODE...`);
  const idsList = await fetcher("account/sync"); // Fetch IDs as you do in the cron

  if (ENVIRONMENT === "development") {
    const LOCALTEST = { PATH: "Club", ID: 242, continue: true };
    taskRunnerQueue.add({
      getSync: LOCALTEST,
    });
  } else {
    if (idsList && idsList.length) {
      console.log(`Received ${idsList.length} IDs for manual test.`);
      //console.log(idsList)
      idsList.forEach(ITEM => taskRunnerQueue.add({getSync:ITEM}));
    } else {
      console.log("No tasks available for manual testing.");
    }
  }
}

// Call it directly for testing
//testTaskRunnerQueue(); 