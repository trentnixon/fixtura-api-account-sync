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
    throw new Error(`Unsupported NODE_ENV: "${ENVIRONMENT}". Supported environments are: ${Object.keys(QUEUE_CONFIG).join(', ')}`);
}

// 2. Queue Configurations & Error Handling
const errorHandler = (queueName) => {
    return (job, err) => {
        logger.critical(`An error occurred on ${queueName}`, {
            file: "worker.js",
            function: `${queueName}JobProcessing`,
            jobID: job.id,
            jobData: job.data,
            error: err
        });
    };
};

// 3. AccountInit Queue
const accountInitQueue = new Queue(QUEUE_CONFIG[ENVIRONMENT].accountInit, process.env.REDISCLOUD_URL);

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
            stack: error.stack
        });
        throw error;
    }
});

accountInitQueue.on('failed', errorHandler('accountInit'));

cron.schedule("*/1 * * * *", async () => {
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
            stack: error.stack
        });
    }
}, { timezone: "Australia/Sydney" });


// TaskRunner Queue
const taskRunnerQueue = new Queue(QUEUE_CONFIG[ENVIRONMENT].taskRunner, process.env.REDISCLOUD_URL);
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
            stack: error.stack
        });
        throw error;
    }
});

taskRunnerQueue.on('failed', errorHandler('taskRunner'));

cron.schedule("0 0 * * *", async () => {
    try {
        const idsList = await fetcher("account/sync");
        idsList.forEach(ITEM => taskRunnerQueue.add({getSync:ITEM}));
    } catch (error) {
        logger.error("Error in taskRunner cron job", {
            error: error.message,
            stack: error.stack
        });
    }
}, {
    timezone: "Australia/Sydney",
});




async function testTaskRunnerQueue() {
    console.log("Manually triggering taskRunnerQueue for testing...");
    const idsList = await fetcher("account/sync"); // Fetch IDs as you do in the cron

    if (idsList && idsList.length) {
        console.log(`Received ${idsList.length} IDs for manual test.`);
        idsList.forEach(ITEM => taskRunnerQueue.add({getSync:ITEM}));
    } else {
        console.log("No tasks available for manual testing.");
    }
}

// Call it directly for testing
//testTaskRunnerQueue();





/* cron.schedule("1 * * * *", async () => {
    console.log("Checking if there's any task for taskRunnerQueue");
    const getSync = await fetcher("account/sync");
    console.log(getSync)
    if (getSync && getSync.continue === true) {
        console.log("Adding task to taskRunnerQueue");
        taskRunnerQueue.add(getSync);
    } else {
        console.log("No task to add for taskRunner at the moment.");
    }
}, {
    timezone: "Australia/Sydney",
}); */


/* async function startTaskRunner() {
    console.log("startTaskRunnerstartTaskRunnerstartTaskRunner")
  try {
    const getSync = await fetcher("account/sync");

    if (getSync.continue === true) {
    
      getSync.PATH === "CLUB"
        ? await Controller_Club(getSync)
        : await Controller_Associations(getSync);
   
    } else {
      console.log("startTaskRunner Check! No Account to Update");
    }
  } catch (error) {
    console.error("Error executing the task:", error);
    logger.error(`An error occurred on startTaskRunner ${error}`);
    logger.critical("An error occurred on startTaskRunner", {
      file: "worker.js",
      function: "startTaskRunner",
      error: error,
    });
  }
} */


/* async function accountInit() {
    console.log("accountInitaccountInitaccountInit")
  try {
    const getSync = await fetcher("account/AccountInit");
    if (getSync.continue === true) {
      console.log("account Init Return Value", getSync.ID);
      logger.warn(`INIT accountInit Started ${getSync.ID} ...`);
      getSync.PATH === "CLUB"
        ? await Controller_Club(getSync)
        : await Controller_Associations(getSync);
      console.log("Task successfully executed");
      await fetcher(`accounts/${getSync.ID}`, "PUT", {
        data: { isSetup: true },
      });
      logger.warn(`accountInit Completed ${getSync.ID} ...`);
    } else {
      console.log("accountInit Check! No Account to Update");
    }
  } catch (error) {
    console.error("Error executing the task in accountInit:", error);
    logger.critical("An error occurred on accountInit", {
      file: "worker.js",
      function: "accountInit",
      error: error,
    });
  }
} */
/* accountInitQueue.process(async (job) => {
  try {
    await accountInit();
    console.log("Account init task successfully executed");
  } catch (error) {
    console.error("Error executing the accountInit task:", error);
    logger.error(`An error occurred on accountInit ${error}`);
  }
}); */

/* if(process.env.NODE_ENV === "development") {
  taskRunnerQueueName = "taskRunnerDev";
  accountInitQueueName = "accountInitDev";
} else if (process.env.NODE_ENV === "production") {
  taskRunnerQueueName = "taskRunner";
  accountInitQueueName = "accountInit";
} else {
  throw new Error("Undefined Node Environment");
} */