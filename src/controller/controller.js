/*  REFER TO TEH ORIGINAL ONE OF THE ROOT FOR A BACK UP*/
const DataController = require("../../dataProcessing/controllers/dataController");
const logger = require("../utils/logger");
const ConnectionHealthCheck = require("../utils/connectionHealthCheck");

// THIS IS THE ENTRY POINT INTO THE SCRAPE!
async function Controller_Club(fromRedis) {
  try {
    // Check connection health before starting
    const healthCheck = new ConnectionHealthCheck();
    const isHealthy = await healthCheck.checkHealth();

    if (!isHealthy) {
      logger.warn(
        "API connection is unhealthy, but proceeding with caution..."
      );
      healthCheck.logStatus();
    }

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
    // Check connection health before starting
    const healthCheck = new ConnectionHealthCheck();
    const isHealthy = await healthCheck.checkHealth();

    if (!isHealthy) {
      logger.warn(
        "API connection is unhealthy, but proceeding with caution..."
      );
      healthCheck.logStatus();
    }

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

/**
 * Controller for on-demand account updates only (no data processing).
 * Fetches fresh account data without processing competitions, teams, or games.
 */
async function Controller_UpdateAccountOnly(fromRedis) {
  try {
    // Check connection health before starting
    const healthCheck = new ConnectionHealthCheck();
    const isHealthy = await healthCheck.checkHealth();

    if (!isHealthy) {
      logger.warn(
        "API connection is unhealthy, but proceeding with caution..."
      );
      healthCheck.logStatus();
    }

    const dataController = new DataController(fromRedis.getSync);
    const result = await dataController.updateAccountOnly();
    return result;
  } catch (error) {
    logger.critical("An error occurred in Controller_UpdateAccountOnly", {
      file: "controller.js",
      function: "Controller_UpdateAccountOnly",
      error: error,
    });
    throw error;
  }
}

module.exports = {
  Controller_Club,
  Controller_Associations,
  Controller_UpdateAccountOnly,
};
