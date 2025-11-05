const DataService = require("../services/dataService");
const MemoryTracker = require("../utils/memoryTracker");
const CompetitionProcessor = require("../processors/competitionProcessor");
const TeamProcessor = require("../processors/teamProcessor");
const GameDataProcessor = require("../processors/gameDataProcessor");
const CRUDOperations = require("../services/CRUDoperations");
const ProcessingTracker = require("../services/processingTracker");

const errorHandler = require("../utils/errorHandler");
const logger = require("../../src/utils/logger");

class DataController {
  constructor(fromRedis) {
    this.fromRedis = fromRedis;
    this.dataService = new DataService();
    this.memoryTracker = new MemoryTracker();
    this.CRUDOperations = new CRUDOperations();
    if (!ProcessingTracker.instance) {
      new ProcessingTracker();
    }
    this.processingTracker = ProcessingTracker.getInstance();
  }

  async reSyncData() {
    return await this.dataService.fetchData(this.fromRedis);
  }

  /**
   * Update account data only - fetches fresh account data without processing competitions, teams, or games.
   * This is used for on-demand account updates that only refresh account metadata.
   */
  async updateAccountOnly() {
    try {
      // Fetch fresh account data from CMS
      const dataObj = await this.reSyncData();

      logger.info(
        `Account data fetched successfully for account ${dataObj.ACCOUNT.ACCOUNTID} (${dataObj.ACCOUNT.ACCOUNTTYPE})`
      );

      // Return success without processing competitions, teams, or games
      return { Complete: true, accountId: dataObj.ACCOUNT.ACCOUNTID };
    } catch (error) {
      errorHandler.handle(error, "DataController");
      logger.error("Error in updateAccountOnly:", {
        accountId: this.fromRedis?.ID,
        error: error.message,
      });
      return { Complete: false };
    }
  }

  async start() {
    try {
      this.memoryTracker.startTracking();
      const startTime = new Date();

      // Fetch data
      let dataObj = await this.reSyncData();

      // Create a data collection entry
      const collectionID = await this.dataService.initCreateDataCollection(
        dataObj.ACCOUNT.ACCOUNTID
      );
      await this.processingTracker.updateDatabaseAfterAction(collectionID);
      await this.processingTracker.setCurrentStage(
        "competitions",
        collectionID
      );

      // Process and assign competitions
      // last checked: 25/10/24
      await this.ProcessCompetitions(dataObj);
      await this.processingTracker.completeStage("competitions", collectionID);
      dataObj = await this.reSyncData();

      // Process and assign Teams
      // last checked: 25/10/24
      await this.processingTracker.setCurrentStage("teams", collectionID);
      await this.ProcessTeams(dataObj);
      await this.processingTracker.completeStage("teams", collectionID);
      dataObj = await this.reSyncData();

      // Process and assign Games
      await this.processingTracker.setCurrentStage("games", collectionID);
      await this.ProcessGames(dataObj);
      await this.processingTracker.completeStage("games", collectionID);

      await this.ProcessTracking(startTime, collectionID);

      return { Complete: true };
    } catch (error) {
      errorHandler.handle(error, "DataController");
      return { Complete: false };
    } finally {
      this.memoryTracker.stopTracking();
      this.processingTracker.resetTracker();
    }
  }

  // Processes
  ProcessCompetitions = async (dataObj) => {
    // Process and assign competitions
    const competitionProcessor = new CompetitionProcessor(dataObj);
    await competitionProcessor.process();
    /* ********************* */
    //throw new Error('THROW ERROR IN ProcessCompetitions');
    /* ********************* */
  };

  ProcessTeams = async (dataObj) => {
    // Process and assign teams
    const teamProcessor = new TeamProcessor(dataObj);
    await teamProcessor.process();
    /* ********************* */
    //throw new Error('THROW ERROR IN ProcessTeams');
    /* ********************* */
  };

  ProcessGames = async (dataObj) => {
    try {
      // Process and assign game data
      const gameDataProcessor = new GameDataProcessor(dataObj);
      await gameDataProcessor.process();
    } catch (error) {
      logger.error("Error in ProcessGames:", error);

      // Check if it's a connection-related error
      if (error.message && error.message.includes("ECONNREFUSED")) {
        logger.critical(
          "API connection failed during game processing. Please check your API server status.",
          {
            method: "ProcessGames",
            class: "DataController",
            error: error.message,
          }
        );
      }

      // Re-throw the error to be handled by the main try-catch
      throw error;
    }
  };

  ProcessTracking = async (startTime, collectionID) => {
    // Calculate processing time and memory usage
    const TimeTaken = new Date() - startTime;
    const MemoryUsage = this.memoryTracker.getPeakUsage();

    // Update data collection with processing details
    const processingData = this.processingTracker.getTracker();
    //console.log("Processing data to be updated:", processingData);

    await this.CRUDOperations.updateDataCollection(collectionID, {
      TimeTaken,
      MemoryUsage,
      processingTracker: processingData,
    });

    logger.info(
      `Data processing completed in ${
        TimeTaken / 1000
      } seconds with peak memory usage: ${MemoryUsage} MB`
    );
  };
}

module.exports = DataController;
// Developer Notes:
// - This class orchestrates the data processing flow, ensuring data is processed and assigned correctly.
// - Modular design with separate methods for each data category.
// - Enhanced error handling for better debugging and tracking.

// Future Improvements:
// - Consider adding more detailed logging for better monitoring and debugging.
// - Explore the possibility of implementing a more dynamic and flexible error handling mechanism.
// - Investigate options for optimizing memory usage and performance.
