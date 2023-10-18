/*
AI PROMPT 

Lets Refactor the following class, function, or component, adhere to SOLID principles, robust error handling, and efficient management of large and long-term memory storage for maintainability, scalability, and seamless integration within the system.

*/

const cron = require("node-cron");
const { Controller_Club, Controller_Associations } = require("./controller");
const fetcher = require("./api/Utils/fetcher");
const logger = require("./api/Utils/logger");
const Queue = require("bull");
const dotenv = require("dotenv");
dotenv.config();

let taskRunnerQueueName, accountInitQueueName;

if (process.env.NODE_ENV === "development") {
  taskRunnerQueueName = "taskRunnerDev";
  accountInitQueueName = "accountInitDev";
} else if (process.env.NODE_ENV === "production") {
  taskRunnerQueueName = "taskRunner";
  accountInitQueueName = "accountInit";
} else {
  throw new Error("Undefined Node Environment");
}

const taskRunnerQueue = new Queue(taskRunnerQueueName, process.env.REDISCLOUD_URL);
const accountInitQueue = new Queue(accountInitQueueName, process.env.REDISCLOUD_URL);

taskRunnerQueue.process(async (job) => {
  try {
    await startTaskRunner();
    console.log("Task successfully executed");
  } catch (error) {
    console.error("Error executing the task:", error);
    logger.error(`An error occurred on startTaskRunner ${error}`);
  }
});

accountInitQueue.process(async (job) => {
  try {
    await accountInit();
    console.log("Account init task successfully executed");
  } catch (error) {
    console.error("Error executing the accountInit task:", error);
    logger.error(`An error occurred on accountInit ${error}`);
  }
});

cron.schedule("*/3 * * * 3,4,5,6,7", () => {
  console.log("Adding task to taskRunnerQueue");
  taskRunnerQueue.add({});
}, {
  timezone: "Australia/Sydney",
});

cron.schedule("*/1 * * * *", () => {
  console.log("Adding task to accountInitQueue");
  accountInitQueue.add({});
}, {
  timezone: "Australia/Sydney",
});


async function startTaskRunner() {
  try {
    const getSync = await fetcher("account/sync");
    //{ PATH: 'CLUB', ID: 1 }
    console.log("start TaskRunner Return Value", getSync);
    ;
    if (getSync.continue === true) {
      logger.warn(`INIT startTaskRunner Started ${getSync.ID} ...`) 
      // Start tracking memory usage
      getSync.PATH === "CLUB"
        ? await Controller_Club(getSync)
        : await Controller_Associations(getSync);
      console.log("Task successfully executed");
      logger.warn(`... startTaskRunner Completed ${getSync.ID}`);
    } else {
      console.log("startTaskRunner Check! No Account to Update");
    }
  } catch (error) {
    console.error("Error executing the task:", error);
    logger.error(`An error occurred on startTaskRunner ${error}`);
    logger.critical("An error occurred on Init", {
      file: "worker.js",
      function: "startTaskRunner",
      error: new Error("Oops!"),
    });
  } 
}

async function accountInit() {
  try {
    const getSync = await fetcher("account/AccountInit");
    //{ PATH: 'CLUB', ID: 1 } 
  
    if (getSync.continue === true) {
      console.log("account Init Return Value", getSync.ID);
      logger.warn(`INIT accountInit Started ${getSync.ID} ...`);
      // Start tracking memory usage
      getSync.PATH === "CLUB"
        ? await Controller_Club(getSync)
        : await Controller_Associations(getSync);
      console.log("Task successfully executed");

      await fetcher(`accounts/${getSync.ID}`, "PUT", {
        data: { isSetup: true }, 
      });
      logger.warn(` accountInit Completed ${getSync.ID} ...`);
    } else {
      console.log("accountInit Check! No Account to Update");
    }
  } catch (error) {
    console.error("Error executing the taskin accountInit :", error);

    logger.critical("An error occurred on accountInit Init", {
      file: "worker.js",
      function: "startTaskRunner",
      error: new Error("Oops!"),
    });
  } 
}

// this can stay open as it only runs a test for updates
//startTaskRunner();  
//accountInit()