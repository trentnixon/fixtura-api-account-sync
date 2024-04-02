//const ClubDetailsController = require("./api/Puppeteer/ClubDetails/GetClubDetails");
//const AssociationDetailsController = require("./api/Puppeteer/AssociationDetails/AssociationDetailsController");
// DataCenter
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
const logger = require("./api/Utils/logger");
/*
  Notes for next time:
 

*/

/* CLUB */
async function Controller_Club(FromSTRAPI) {
  try {
    //const intervalId = trackMemoryUsage();

    // Step 1 -  Get the conditioned Data
    let DATAOBJ = await dataCenterClubs(FromSTRAPI);
    //console.log(DATAOBJ);
    // Step 2 Get the Competitions and Assign them to the Account Type
    await Master_ScrapeCompetitions(DATAOBJ);
    // Step 3 Get Detailed Account data from Strapi
    DATAOBJ = await dataCenterClubs(FromSTRAPI);
    await Master_ScrapeTeams(DATAOBJ);
    DATAOBJ = await dataCenterClubs(FromSTRAPI);
    // console.log(DATAOBJ);
    await Master_ScrapeGameData(DATAOBJ);

    //clearInterval(intervalId);
    return { Complete: true };
  } catch (error) {
    //clearInterval(intervalId);
    console.error(`Error getting Club Details: ${error}`);

    logger.critical("An error occurred in Controller_Club", {
      file: "updateTask.js",
      function: "Controller_Club",
      error: error,
    });
    throw error;
  }
}

/* ASSOCIATION */
async function Controller_Associations(FromSTRAPI) {
  try {
    //Step 1 -  Get the conditioned Data
    let DATAOBJ = await dataCenterAssociations(FromSTRAPI);
    //console.log(DATAOBJ);
    // Step 2 Get the Competitions and Assign them to the Account Type
    await Master_ScrapeCompetitions(DATAOBJ);
    // Step 3 Get Detailed Account data from Strapi
    DATAOBJ = await dataCenterAssociations(FromSTRAPI);
    //console.log(DATAOBJ);
    await Master_ScrapeTeams(DATAOBJ);
    //console.log(TEAMLIST)
    DATAOBJ = await dataCenterAssociations(FromSTRAPI);
    await Master_ScrapeGameData(DATAOBJ);
  
    return { Complete: true };
  } catch (error) {
   
    console.error(`Error getting Association Details: ${error}`);
    logger.critical("An error occurred in Controller_Associations", {
      file: "updateTask.js",
      function: "Controller_Associations",
      error: error,
    });
    throw error;
  }
}

module.exports = { Controller_Club, Controller_Associations };

/* MASTER SET*/

// Competitions
async function Master_ScrapeCompetitions(DATAOBJ) {
  //Step 1 - Get Comps from PlayHQ
  const getCompetitionsObj = new GetCompetitions(
    DATAOBJ.TYPEOBJ.TYPEURL,
    DATAOBJ.ACCOUNT
  );
  const ScrapedCompetitions = await getCompetitionsObj.setup();
  //Step 2 - Assign the Comps to the Account Type
  //console.log(ScrapedCompetitions);
  const assignScrapedCompetitions = new AssignCompetitions(
    ScrapedCompetitions,
    DATAOBJ
  );
  await assignScrapedCompetitions.setup();
}

// Teams

async function Master_ScrapeTeams(DATAOBJ) {
  const ClubTeams = new GetTeamsFromLadder(DATAOBJ.ACCOUNT, DATAOBJ.Grades);
  const teamList = await ClubTeams.setup();
  const assignTeam = new AssignTeamsToCompsAndGrades();
  await assignTeam.setup(teamList);
}

async function Master_ScrapeGameData(DATAOBJ) {
  const scrapeGameData = new getGameData(DATAOBJ.ACCOUNT, DATAOBJ.TEAMS);
  const filteredArray = await scrapeGameData.setup();
  const assignGameDataOBJ = new assignGameData();
  await assignGameDataOBJ.setup(filteredArray);
}

/* END MASTER SET*/

function trackMemoryUsage(interval = 20000) {
  const intervalId = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const memoryUsageInfo = Object.entries(memoryUsage)
      .map(([key, value]) => {
        return `${key}: ${(value / 1024 / 1024).toFixed(2)} MB`;
      })
      .join(", ");

    console.log(`Memory Usage: ${memoryUsageInfo}`);
  }, interval);

  return intervalId;
}

/*
// Club
// WHAT IS THIS?
// HAVE I MISSED SOMETHING?
async function Master_ScrapeAssociationClubs(DATAOBJ) {
  const ClubTeams = new GetClubTeams(DATAOBJ.ACCOUNT, DATAOBJ.CompetitionURLS);
  return await ClubTeams.setup();
}
*/
