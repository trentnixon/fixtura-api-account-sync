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

/**
 * Controller for direct club ID processing (bypasses account lookup).
 * Uses direct data fetching and pseudo account ID.
 */
async function Controller_ClubDirect(fromRedis) {
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

    // Extract club ID and org type from job data
    const clubId = fromRedis.getSync?.ID;
    const accountPath = fromRedis.getSync?.PATH;

    // Validate job data
    if (!clubId) {
      throw new Error("Missing club ID in job data");
    }

    if (accountPath !== "CLUB") {
      throw new Error(
        `Invalid PATH for club direct sync: ${accountPath}. Expected "CLUB"`
      );
    }

    logger.info("🏢 Starting direct club processing", {
      clubId: clubId,
    });

    // Create DataController with pseudo account ID structure
    // The controller will use direct data fetching
    const dataController = new DataController({
      ID: clubId, // Will be used as org ID for direct fetching
      PATH: "CLUB",
      DIRECT: true, // Flag to indicate direct mode
    });

    // Use direct data fetching for all data refreshes
    // Override reSyncData to use direct fetching
    const originalReSyncData = dataController.reSyncData.bind(dataController);
    dataController.reSyncData = async function () {
      return await this.reSyncDataDirect(clubId, "CLUB");
    };

    // Process as normal (competitions, teams, games, etc.)
    await dataController.start();

    logger.info("✅ Successfully completed direct club processing", {
      clubId: clubId,
    });

    return { Complete: true };
  } catch (error) {
    const clubId = fromRedis.getSync?.ID;
    logger.critical("An error occurred in Controller_ClubDirect", {
      file: "controller.js",
      function: "Controller_ClubDirect",
      clubId: clubId,
      orgType: "CLUB",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Controller for direct association ID processing (bypasses account lookup).
 * Uses direct data fetching and pseudo account ID.
 */
async function Controller_AssociationDirect(fromRedis) {
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

    // Extract association ID and org type from job data
    const associationId = fromRedis.getSync?.ID;
    const accountPath = fromRedis.getSync?.PATH;

    // Validate job data
    if (!associationId) {
      throw new Error("Missing association ID in job data");
    }

    if (accountPath !== "ASSOCIATION") {
      throw new Error(
        `Invalid PATH for association direct sync: ${accountPath}. Expected "ASSOCIATION"`
      );
    }

    logger.info("🏛️ Starting direct association processing", {
      associationId: associationId,
    });

    // Create DataController with pseudo account ID structure
    // The controller will use direct data fetching
    const dataController = new DataController({
      ID: associationId, // Will be used as org ID for direct fetching
      PATH: "ASSOCIATION",
      DIRECT: true, // Flag to indicate direct mode
    });

    // Use direct data fetching for all data refreshes
    // Override reSyncData to use direct fetching
    const originalReSyncData = dataController.reSyncData.bind(dataController);
    dataController.reSyncData = async function () {
      return await this.reSyncDataDirect(associationId, "ASSOCIATION");
    };

    // Process as normal (competitions, teams, games, etc.)
    await dataController.start();

    logger.info("✅ Successfully completed direct association processing", {
      associationId: associationId,
    });

    return { Complete: true };
  } catch (error) {
    const associationId = fromRedis.getSync?.ID;
    logger.critical("An error occurred in Controller_AssociationDirect", {
      file: "controller.js",
      function: "Controller_AssociationDirect",
      associationId: associationId,
      orgType: "ASSOCIATION",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  Controller_Club,
  Controller_Associations,
  Controller_UpdateAccountOnly,
  Controller_ClubDirect,
  Controller_AssociationDirect,
};
