const cron = require("node-cron");
const { updateClubDetails, updateAssociationDetails } = require("./updateTask");
const fetcher = require("./api/Utils/fetcher");

/*
AI PROMPT

Lets Refactor the following class, function, or component, adhere to SOLID principles, robust error handling, and efficient management of large and long-term memory storage for maintainability, scalability, and seamless integration within the system.

*/
// Schedule a task to run every 5 minutes
cron.schedule("*/1 * * * *", async () => {
  // need to run a call to STRAPI to find an ID to run
  startTaskRunner();
});

async function startTaskRunner() {
  try {
    const getSync = await fetcher("account/sync");
    //{ PATH: 'CLUB', ID: 1 }
    console.log("getSync", getSync);
    if (getSync.continue === true) {
      // Start tracking memory usage
      getSync.PATH === "CLUB"
        ? await updateClubDetails(getSync.ID)
        : await updateAssociationDetails(getSync.ID);
      console.log("Task successfully executed");
    } else {
      console.log("No Account to Update");
    }
  } catch (error) {
    console.error("Error executing the task:", error);
  }
}