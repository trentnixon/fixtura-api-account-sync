const cron = require("node-cron");
const { Controller_Club, Controller_Associations } = require("./controller");
const fetcher = require("./api/Utils/fetcher");
const logger = require("./api/Utils/logger");

/*
AI PROMPT 

Lets Refactor the following class, function, or component, adhere to SOLID principles, robust error handling, and efficient management of large and long-term memory storage for maintainability, scalability, and seamless integration within the system.

*/
// Schedule a task to run every 5 minutes
cron.schedule(
  "*/3 * * * 3,4,5,6,7",
  async () => {
    // need to run a call to STRAPI to find an ID to run
    console.log("Run Account Cron Checker")
    startTaskRunner();
  },
  {
    timezone: "Australia/Sydney",
  }
);

cron.schedule(
  "*/1 * * * *",
  async () => {
    // need to run a call to STRAPI to find an ID to run
    accountInit();
  },
  {
    timezone: "Australia/Sydney",
  }
);

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

//startTaskRunner();

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
