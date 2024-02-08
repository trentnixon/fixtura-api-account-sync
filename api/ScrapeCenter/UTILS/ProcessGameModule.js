const logger = require("../../Utils/logger");
const moment = require("moment");
const Constants = require("./Constants");
const {
  ScrapeRound,
  ScrapeDate,
  ScrapeGameURL,
  ScrapeTeams,
  ScrapeStatus,
  scrapeTypeTimeGround,
  ScrapeChildren,
} = require("./ScrapeItems");

function checkString(value, defaultValue = "") {
  if (typeof value !== "string") {
    logger.error(`Unexpected type. Expected string but received ${typeof value}. Defaulting to default value.`);
    return defaultValue;
  }
  return value;
}

async function ProcessGameModule(matchList, GradeID) { 
  let teamMatches = [];

  for (let index = 0; index < matchList.length; index++) {
    try {
      const matchElement = matchList[index];
      await processIndividualMatch(matchElement, GradeID, teamMatches, index);
    } catch (error) {
      logger.error(`Error processing match (Index ${index}) in ProcessGame:`, error);
      logger.critical("An error occurred in ProcessGame", {
        file: "getGameData.js",
        function: "ProcessGame",
        error: error,
      });
    }
  }
  return teamMatches.filter((match) => match !== null); 
}

async function processIndividualMatch(matchElement, GradeID, teamMatches, index) {
    
    // Check for 'bye' condition
    if (await isByeMatch(matchElement)) {
      teamMatches.push({ status: "bye" });
      return;  // Continue to the next match in the main loop
    }
   
    let round = checkString(await ScrapeRound(matchElement, Constants.SELECTORS.ROUND.General));
    let date = checkString(await ScrapeDate(matchElement, Constants.SELECTORS.DATE.General));
    let dateObj = moment(date, "dddd, DD MMMM YYYY").toDate();
    let countChildren = await ScrapeChildren(matchElement, Constants.SELECTORS.CHILDREN);
    
    //console.log("index", index);
    //console.log(`Date has ${countChildren} Divs in it. xPath is ${Constants.SELECTORS.CHILDREN}`);
    
    // Skip processing this match if it appears to be a 'bye', but don't return from the function
    if (countChildren === 0) {
      //console.log(`This game has ${countChildren} Children, it must be a BYE`);
      return;  // Continue to the next match in the main loop
    }
  
    for (let gameIndex = 1; gameIndex <= countChildren - 1; gameIndex++) {
      //console.log("gameIndex", gameIndex, "countChildren", countChildren);
      let baseXpath = `li[data-testid='games-on-date'] > div:nth-child(${gameIndex + 1})`;
     
      await processGameDetails(matchElement, baseXpath, teamMatches, GradeID, { round, date, dateObj });
    }
  }
  

async function isByeMatch(matchElement) {
  const byeSelector = await matchElement.$(".sc-jrsJCI.gcJhbP");
  return !!byeSelector;
}

async function processGameDetails(matchElement, baseXpath, teamMatches, GradeID, matchInfo) {
    //console.log("baseXpath", baseXpath)
    let { type, time, ground } = await scrapeTypeTimeGround(matchElement, baseXpath);
    let status = checkString(await ScrapeStatus(matchElement, `${baseXpath} ${Constants.SELECTORS.STATUS.STATUS}`));
    let urlToScoreCard = checkString(await ScrapeGameURL(matchElement, `${baseXpath} ${Constants.SELECTORS.URL.General}`)); 
    let gameID = urlToScoreCard ? urlToScoreCard.split("/").slice(-1)[0] : null;
    let teamNames = await ScrapeTeams(matchElement, `${baseXpath} ${Constants.SELECTORS.TEAMS.General}`);

  console.log(`gameID ${gameID} ${teamNames[0].name} vs ${teamNames[1].name} ${urlToScoreCard}`)
  
  teamMatches.push({
    grade: [GradeID],
    round: matchInfo.round,
    date: matchInfo.date,
    dayOne: matchInfo.dateObj,
    type: checkString(type),
    time: checkString(time),
    ground: checkString(ground),
    status,
    urlToScoreCard,
    gameID,
    teams: [],
    teamHomeID: teamNames[0].id,
    teamAwayID: teamNames[1].id,
    teamHome: teamNames[0].name,
    teamAway: teamNames[1].name,
  });
}

module.exports = {
  ProcessGameModule,
};
