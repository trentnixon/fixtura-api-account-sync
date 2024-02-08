/*  REFER TO TEH ORIGINAL ONE OF THE ROOT FOR A BACK UP*/
const DataController = require("../../dataProcessing/controllers/dataController");
const logger = require("../utils/logger");

// THIS IS THE ENTRY POINT INTO THE SCRAPE!
async function Controller_Club(fromRedis) {
  try {
    const dataController = new DataController(fromRedis.getSync);
    await dataController.start();
    return { Complete: true };
  } catch (error) {
    logger.critical("An error occurred in Controller_Club", {
      file: "controller.js",
      function: "Controller_Club",
      error: error,
    });
    throw error;
  }
}

async function Controller_Associations(fromRedis) {
  try {
    const dataController = new DataController(fromRedis.getSync);
    await dataController.start();
    return { Complete: true };
  } catch (error) { 
    logger.critical("An error occurred in Controller_Associations", {
      file: "controller.js",
      function: "Controller_Associations",
      error: error,
    });
    throw error;
  }
}

module.exports = { Controller_Club, Controller_Associations };
