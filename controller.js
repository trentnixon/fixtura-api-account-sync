const { dataCenterClubs } = require("./api/DataCenter/evaluateClubs");
const {
  dataCenterAssociations,
} = require("./api/DataCenter/evaluateAssociations");
const GetCompetitions = require("./api/ScrapeCenter/getCompetitions");
const AssignCompetitions = require("./api/AssignCenter/AssignCompetitions");

const GetTeamsFromLadder = require("./api/ScrapeCenter/getTeamsFromLadder");
const AssignTeamsToCompsAndGrades = require("./api/AssignCenter/AssignTeamsToCompsAndGrades");

const getGameData = require("./api/ScrapeCenter/getGameData");
const assignGameData = require("./api/AssignCenter/assignGameData");

const BaseController = require("./common/BaseController");
const logger = require("./api/Utils/logger");

function trackMemoryUsage(interval = 20000) {
  let peakMemoryUsage = 0;

  const intervalId = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const totalMemoryMB = memoryUsage.rss / 1024 / 1024;
    peakMemoryUsage = Math.max(peakMemoryUsage, totalMemoryMB);

    const memoryUsageInfo = Object.entries(memoryUsage)
      .map(([key, value]) => `${key}: ${(value / 1024 / 1024).toFixed(2)} MB`)
      .join(", ");

    console.log(`Memory Usage: ${memoryUsageInfo}`);
  }, interval);

  return { intervalId, getPeakUsage: () => peakMemoryUsage };
}

class DataController extends BaseController {
  constructor(dataCenter, strapiData) {
    super(); // Add this line
    this.dataCenter = dataCenter;
    this.strapiData = strapiData;
    this.memoryTracker = null;
  }

  async fetchAndUpdateData() {
    let hasError = false;
    this.memoryTracker = trackMemoryUsage(); // Start memory tracking
    const startTime = new Date(); // Start time

    //** This section deals with Data Collection and Status Updating */
    let dataObj;
    let CollectionID;
    try {
      // Create DataOBJ for Account Type
      dataObj = await this.dataCenter(this.strapiData);

      CollectionID = await this.initCreateDataCollection(
        dataObj.ACCOUNT.ACCOUNTID
      );

      //console.log("CollectionID", CollectionID);
    } catch (error) {
      console.error(`Error initializing data: ${error}`);
      hasError = true;

      logger.critical("An error occurred in fetchAndUpdateData", {
        file: "controller.js",
        function: "fetchAndUpdateData",
        error: error,
      });
    }

    /** Now lets fetch the Data about this account */ 
    try {
      console.log("STAT ACCOUNT SET UP");

          /*    
            console.log(dataObj)
            throw new Error("STOP HERE BEFORE processGameData"); 
          */

       // Scrap and process the Competition Data
      await this.processAndAssignCompetitions(dataObj);
      // Get an Updated DataOBJ for Account Type
      dataObj = await this.dataCenter(this.strapiData); 

      // Scrap the Teams Data
      await this.processTeams(dataObj);  
      // Get an Updated DataOBJ for Account Type
      dataObj = await this.dataCenter(this.strapiData);
      //console.log(dataObj);
      /*  throw new Error("STOP HERE BEFORE processGameData"); */
      // Process Game Data 
      await this.processGameData(dataObj); 

    } catch (error) {
      console.error(`Error processing data: ${error}`);
      hasError = true;
      logger.critical("An error occurred in fetchAndUpdateData", {
        file: "controller.js",
        function: "fetchAndUpdateData",
        error: error,
      });
    }

    //** Lets now clean up the memory */
    clearInterval(this.memoryTracker.intervalId); // Stop memory tracking
    const peakMemoryUsage = this.memoryTracker.getPeakUsage();
    const endTime = new Date(); // End time
    const timeTaken = endTime - startTime; // Time taken in milliseconds
    console.log(`Time taken: ${timeTaken / 1000} seconds`);

    try {
      console.log("Update Datacollection");
      await this.initUpdateDataCollection(CollectionID, {
        TimeTaken: timeTaken / 1000,
        MemoryUsage: peakMemoryUsage,
        hasError: hasError,
      });
    } catch (error) {
      console.error(`Error updating data collection: ${error}`);
      // If an error happens while updating the data collection, you might want to handle it differently.
      logger.critical("An error occurred in fetchAndUpdateData", {
        file: "controller.js",
        function: "fetchAndUpdateData",
        error: error,
      });
    }
  }

  /****************************** */
  /** HELPER FUNCS  */
  /****************************** */
  async processAndAssignCompetitions(dataObj) {
    const getCompetitionsObj = new GetCompetitions(
      dataObj.TYPEOBJ.TYPEURL,
      dataObj.ACCOUNT
    );

    const scrapedCompetitions = await getCompetitionsObj.setup();

    /*   console.log("scrapedCompetitionsscrapedCompetitionsscrapedCompetitionsscrapedCompetitions")
     console.log(scrapedCompetitions)
     throw new Error('STOP HERE');  */

    const assignScrapedCompetitions = new AssignCompetitions(
      scrapedCompetitions,
      dataObj
    );
    await assignScrapedCompetitions.setup();
  }

  async processTeams(dataObj) {
    //console.log(dataObj.Grades);

    const clubTeams = new GetTeamsFromLadder(dataObj.ACCOUNT, dataObj.Grades);
    const teamList = await clubTeams.setup();

     
 /*      console.log("teamList");
      throw new Error("STOP HERE"); */
   
    const assignTeam = new AssignTeamsToCompsAndGrades();
    await assignTeam.setup(teamList);
  }


  async processGameData(dataObj) {
 
    /*  const TestTeamsOBJ=[{
      teamName: 'Whanganui Renegades T20',
      id: 6882,
      href: '/new-zealand-cricket/org/whanganui-renegades-cricket-club/1226a03c/cricket-whanganui-premier-cricket-summer-202324/teams/whanganui-renegades-t20/a9f24d9e',
      grade: 7846
    }] */
    const useTeamsOBJ =  dataObj.TEAMS
   
    const scrapeGameData = new getGameData(dataObj.ACCOUNT,useTeamsOBJ );

    // Suppose each batch fetches data for 10 teams (this number can be adjusted)
    const batchSize = 10;
    const totalBatches = Math.ceil(useTeamsOBJ.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const currentBatchTeams = useTeamsOBJ.slice(i * batchSize, (i + 1) * batchSize);
        
        // Scrape data for the current batch
        const filteredArray = await scrapeGameData.setupBatch(currentBatchTeams); 
        //console.log(filteredArray)
        // Assign game data for the current batch
        const assignGameDataObj = new assignGameData();
        await assignGameDataObj.setup(filteredArray);  
    }
}
}

// Init Controller

async function Controller_Club(FromSTRAPI) {
  try {
    const dataController = new DataController(dataCenterClubs, FromSTRAPI);
    await dataController.fetchAndUpdateData();
    return { Complete: true };
  } catch (error) {
    console.error(`Error getting Club Details: ${error}`);
    //throw error;
    logger.critical("An error occurred in Controller_Club", {
      file: "controller.js",
      function: "Controller_Club",
      error: error,
    });
  }
}

async function Controller_Associations(FromSTRAPI) {
  try {
    const dataController = new DataController(
      dataCenterAssociations,
      FromSTRAPI
    );
    await dataController.fetchAndUpdateData();
    return { Complete: true }; 
  } catch (error) {
    console.error(`Error getting Association Details: ${error}`);
    //throw error;
    logger.critical("An error occurred in Controller_Associations", {
      file: "controller.js",
      function: "Controller_Associations",
      error: error,
    });
  }
}

module.exports = { Controller_Club, Controller_Associations };

 /*  async processGameData(dataObj) {
    const scrapeGameData = new getGameData(dataObj.ACCOUNT, dataObj.TEAMS);
    const filteredArray = await scrapeGameData.setup();
    const assignGameDataObj = new assignGameData();
    await assignGameDataObj.setup(filteredArray); 
  } */