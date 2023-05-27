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
    this.memoryTracker = trackMemoryUsage();  // Start memory tracking
    const startTime = new Date();  // Start time

    let dataObj;
    let CollectionID;
    try {
      dataObj = await this.dataCenter(this.strapiData);
      CollectionID = await this.initCreateDataCollection(
        dataObj.ACCOUNT.ACCOUNTID
      );
      console.log("CollectionID", CollectionID);
    } catch (error) {
      console.error(`Error initializing data: ${error}`);
      hasError = true;
    }
    
    try {
      await this.processCompetitions(dataObj);
      dataObj = await this.dataCenter(this.strapiData);
      await this.processTeams(dataObj);
      dataObj = await this.dataCenter(this.strapiData);
      await this.processGameData(dataObj);
    } catch (error) { 
      console.error(`Error processing data: ${error}`);
      hasError = true;
    }

    clearInterval(this.memoryTracker.intervalId);  // Stop memory tracking
    const peakMemoryUsage = this.memoryTracker.getPeakUsage();
    const endTime = new Date();  // End time
    const timeTaken = endTime - startTime;  // Time taken in milliseconds
    console.log(`Time taken: ${timeTaken / 1000} seconds`);

    try {
      console.log("Update Datacollection")
      await this.initUpdateDataCollection(CollectionID, {
        TimeTaken: timeTaken / 1000,
        MemoryUsage: peakMemoryUsage,
        hasError: hasError
      });
    } catch (error) {
      console.error(`Error updating data collection: ${error}`);
      // If an error happens while updating the data collection, you might want to handle it differently.
    }
  }


  async processCompetitions(dataObj) {
    const getCompetitionsObj = new GetCompetitions(
      dataObj.TYPEOBJ.TYPEURL,
      dataObj.ACCOUNT
    );
    const scrapedCompetitions = await getCompetitionsObj.setup();
    const assignScrapedCompetitions = new AssignCompetitions(
      scrapedCompetitions,
      dataObj
    );
    await assignScrapedCompetitions.setup();
  }

  async processTeams(dataObj) {
    const clubTeams = new GetTeamsFromLadder(dataObj.ACCOUNT, dataObj.Grades);
    const teamList = await clubTeams.setup();
    const assignTeam = new AssignTeamsToCompsAndGrades();
    await assignTeam.setup(teamList);
  }

  async processGameData(dataObj) {
    const scrapeGameData = new getGameData(dataObj.ACCOUNT, dataObj.TEAMS);
    const filteredArray = await scrapeGameData.setup();
    const assignGameDataObj = new assignGameData();
    await assignGameDataObj.setup(filteredArray);
  }
}

async function Controller_Club(FromSTRAPI) {
  try {
    const dataController = new DataController(dataCenterClubs, FromSTRAPI);
    await dataController.fetchAndUpdateData();
    return { Complete: true };
  } catch (error) {
    console.error(`Error getting Club Details: ${error}`);
    throw error;
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
    throw error;
  }
}

module.exports = { Controller_Club, Controller_Associations };
