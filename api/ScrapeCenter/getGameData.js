const logger = require("../Utils/logger");
const BaseController = require("../../common/BaseController");
//const assignTeamToGameData = require("./assignTeamGameData");
const moment = require("moment");

const SELECTORS = {
  ROUND: {
    General: ".sc-10c3c88-0 h3",
  },
  DATE: {
    General: ".sc-10c3c88-3 span",
  },
  TYPE: {
    General: ".sc-bqGHjH.sc-10c3c88-12.jXIQEt.gWNytY:nth-of-type(1)",
    Cancelled: ".sc-bqGHjH.sc-10c3c88-12.jXIQEt.EVegk",
    Abandoned: ".sc-bqGHjH.sc-dlMBXb.cgkBRp.kRsKWk",
  },
  TIME: {
    General: ".sc-jrsJCI.khmeEf",
    Cancelled: ".sc-jrsJCI.hXclEb",
  },
  GROUNDS: {
    General: ".sc-10c3c88-15 a",
    Cancelled: ".sc-jrsJCI.hXclEb",
  },
  STATUS: {
    Abandonded: ".sc-bqGHjH.sc-dlMBXb.blmUXq.kdsUTq",
    Pending: ".sc-bqGHjH.sc-dlMBXb.blmUXq.bPMkbQ",
    Final: ".sc-bqGHjH.sc-dlMBXb.blmUXq.jAJvWi",
  },
  URL: {
    General: ".sc-10c3c88-6.iKClUy",
  },
  TEAMS: {
    General: ".sc-12j2xsj-0.bVnFqy a",
  },
};

class getTeamsGameData extends BaseController {
  constructor(ACCOUNT, TEAMS) {
    super(); // Add this line
    this.TEAMS = TEAMS;
    this.ACCOUNTID = ACCOUNT.ACCOUNTID;
    this.ACCOUNTTYPE = ACCOUNT.ACCOUNTTYPE;
    this.dependencies = require("../../common/dependencies");
  }

   ensureHttp(url, domain = "https://www.playhq.com") {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return domain + url;
  }
  return url;
}




  async ProcessGame(matchList, GradeID) {
    const teamMatches = await Promise.all(
      matchList.map(async (matchElement, index) => {
        try {
          const byeSelector = await matchElement.$(".sc-jrsJCI.gcJhbP");
          if (byeSelector) {
            return { status: "bye" };
          }

          /* ROUND *********** */
          const round = await ScrapeRound(
            matchElement,
            SELECTORS.ROUND.General
          );

          /* DATE *********** */
          const date = await ScrapeDate(matchElement, SELECTORS.DATE.General);

          const dateStr = date;
          const dateObj = moment(dateStr, "dddd, DD MMMM YYYY").toDate();

          /* TYPE *********** */
          const type = await ScrapeType(matchElement, SELECTORS.TYPE);

          /* TIME *********** */
          let time = await ScrapeTime(matchElement, SELECTORS.TIME);

          /* Ground *********** */
          let ground = await ScrapeGround(matchElement, SELECTORS.GROUNDS);

          /* STATUS *********** */
          let status = await ScrapeStatus(matchElement, SELECTORS.STATUS);

          /* URLS *********** */
          const urlToScoreCard = await ScrapeGameURL(
            matchElement,
            SELECTORS.URL.General
          );
          const gameID = urlToScoreCard
            ? urlToScoreCard.split("/").slice(-1)[0]
            : null;

          /* *********** */
          const teamNames = await ScrapeTeams(
            matchElement,
            SELECTORS.TEAMS.General
          );

          return {
            grade: [GradeID],
            round,
            date,
            dayOne: dateObj,
            type,
            time,
            ground,
            status,
            urlToScoreCard,
            gameID,
            teams: [],
            teamHomeID: teamNames[0].id,
            teamAwayID: teamNames[1].id,
            teamHome: teamNames[0].name,
            teamAway: teamNames[1].name,
          };
        } catch (error) {
          logger.error(
            `Error processing match for team ${teamName} (Index ${index}):`
          );
          logger.error(error);
          return null;
        }
      })
    );

    return teamMatches;
  }

  async LoopTeams() {
    let teamIndex = 0;
    let StoreGames = [];
    const page = await this.browser.newPage();
  
    console.log(`this.TEAMS has a length of ${this.TEAMS.length}`);
    try {
      for (const { teamName, id, href, grade } of this.TEAMS) {
        try {
          logger.info(
            `Processing team ${teamName} id ${id} (Index ${teamIndex} of ${this.TEAMS.length})...`
          );
          logger.info(`on playHQ URL ${href}`);
  
          // Navigate to team page
          console.log(this.ensureHttp(href));
          await page.goto(this.ensureHttp(href));
  
          // Wait for the match list to be rendered
          await page.waitForSelector(
            ".fnpp5x-0.fnpp5x-4.gJrsYc.jWGbFY,.sc-bqGHjH.sc-dlMBXb.blmUXq.jAJvWi"
          );
          await page.waitForTimeout(1000);
  
          // Get the match list
          const matchList = await page.$$(".fnpp5x-0.fnpp5x-4.gJrsYc.jWGbFY");
  
          // Process the games on the page
          const GAMEDATA = await this.ProcessGame(matchList, grade);
  
          // Filter out any null values (i.e. matches that couldn't be processed)
          const validMatches = GAMEDATA.filter((match) => match !== null);
  
          StoreGames.push(...validMatches);
          teamIndex++;
        } catch (error) {
          console.error(`Error processing team ${teamName}:`, error);
          teamIndex++;
        }
      }
      return StoreGames;
    } catch (error) {
      console.error(`Error getting team game data:`, error);
    } finally {
      logger.info(`CLASS GetCompetitions: Page Closed!!`);
      await page.close();
    }
  }
  

  async setup() {
    console.log("Get Game Data : Setup called");
    //console.log("this.TEAMS",  this.TEAMS)
    try {
      await this.initDependencies(this.ACCOUNTID); // Call the initDependencies method from the BaseController
      const result = await this.LoopTeams();
      console.log(`Length after scrape ${result.length}`)
      let filteredArray = result.filter((v, i, a) => a.findIndex(t => (t.gameID === v.gameID)) === i);
      console.log(`Length after Filter  ${filteredArray.length}`)
      return filteredArray;
    } catch (err) {
      logger.error("Error during setup:", err);

      await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
      logger.info("Set Account to False| ERROR ");
      /* await this.dependencies.createDataCollection(this.ACCOUNTID, {
        error: true,
      }); */
      logger.info("Create a Data Entry | ERROR");
    } finally {
      await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
      logger.info("Set Account to False| Finally ");
      /* await this.dependencies.createDataCollection(this.ACCOUNTID, {
        error: true,
      }); */
      logger.info("Create a Data Entry | Finally");
      await this.dispose();
      logger.info("Dispose of items and Pupeteer | Finally");
    }
  }

}

module.exports = getTeamsGameData;

/* *********************************************************** */
// scrape FUNCS
/* *********************************************************** */

const ScrapeLeagueName = async (page) => {
  const LEAGUE_NAME_SELECTOR =
    'span.sc-bqGHjH.fJDYfb[size="16"][font-style="normal"]';
  try {
    const leagueName = await page.$eval(LEAGUE_NAME_SELECTOR, (el) =>
      el.textContent.trim()
    );
    return leagueName;
  } catch (error) {
    console.error("Error scraping league name:", error);
    return false; // Return false when the element is not found
  }
};

const Find_Item = async (matchElement, SELECTOR) => {
  try {
    const element = await matchElement.$(SELECTOR);
    if (element) {
      const item = await matchElement.$eval(SELECTOR, (el) =>
        el.textContent.trim()
      );
      return item;
    } else {
      // Handle the case when the selector is not found
      logger.warn(`Selector "${SELECTOR}" not found.`);
      return false;
    }
  } catch (error) {
    logger.error("Error finding item:", error);
    return false;
  }
};

const ScrapeRound = async (matchElement, SELECTOR) => {
  return await Find_Item(matchElement, SELECTOR);
};
const ScrapeDate = async (matchElement, SELECTOR) => {
  return await Find_Item(matchElement, SELECTOR);
};

const ScrapeGameURL = async (matchElement, SELECTOR) => {
  // return await Find_Item(matchElement, SELECTOR);
  try {
    const url = await matchElement.$eval(SELECTOR, (el) =>
      el.getAttribute("href")
    );
    return url;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const ScrapeTeams = async (matchElement, SELECTOR) => {
  try {
    const teams = await matchElement.$$eval(SELECTOR, (anchors) => {
      return anchors.map((a) => {
        const name = a.textContent.trim();
        const url = a.getAttribute("href");
        const id = url.split("/").pop();
        return { name, id };
      });
    });
    return teams;
  } catch (error) {
    logger.error("Error scraping teams:", error);
    return [];
  }
};

const ScrapeTime = async (matchElement, SELECTORS) => {
  const timeSelector = await Find_Item(matchElement, SELECTORS.General);
  const timeCancelledSelector = await Find_Item(
    matchElement,
    SELECTORS.Cancelled
  );

  if (timeCancelledSelector) {
    return timeCancelledSelector ? timeCancelledSelector : "";
  } else if (timeSelector) {
    return timeSelector ? timeSelector : "";
  }
};

const ScrapeType = async (matchElement, SELECTORS) => {
  const typeSelector = await Find_Item(matchElement, SELECTORS.Abandoned);
  const typeCancelledSelector = await Find_Item(
    matchElement,
    SELECTORS.Cancelled
  );
  const typeRegular = await Find_Item(matchElement, SELECTORS.General);

  if (typeSelector) {
    return typeSelector;
  } else if (typeCancelledSelector) {
    return typeCancelledSelector;
  } else {
    return typeRegular;
  }
};

const ScrapeGround = async (matchElement, SELECTORS) => {
  const groundSelector = await Find_Item(matchElement, SELECTORS.General);
  const groundCancelledSelector = await Find_Item(
    matchElement,
    SELECTORS.Cancelled
  );

  if (groundCancelledSelector) {
    return groundCancelledSelector;
  } else if (groundSelector) {
    return groundSelector;
  }
};

const ScrapeStatus = async (matchElement, SELECTORS) => {
  const statusAbandondedSelector = await Find_Item(
    matchElement,
    SELECTORS.Abandonded
  );
  const statusPendingSelector = await Find_Item(
    matchElement,
    SELECTORS.Pending
  );
  const statusFinalSelector = await Find_Item(matchElement, SELECTORS.Final);

  if (statusAbandondedSelector) {
    return statusAbandondedSelector;
  } else if (statusPendingSelector) {
    return statusPendingSelector;
  } else if (statusFinalSelector) {
    return statusFinalSelector;
  }
};

  /*  async OLDsetup() {  
    logger.info("Setting up getTeamsGameData...");
    console.log("this.ActiveGrades")
    console.log(this.ActiveGrades)
    const page = await this.browser.newPage();
    try {
      await this.LoopTeams(page);
      logger.info("getTeamsGameData setup completed.");
      return true;
    } catch (error) { 
      logger.error("Error setting up getTeamsGameData:", error);
      throw error;
    } finally {
      logger.info(`CLASS getTeamsGameData: Page Closed!!`);
      await page.close();
    }
  } */

/*   async getGradeID(page) {
    logger.info("Getting grade ID...");
    try {
      // Scrape the league name
      const leagueName = await ScrapeLeagueName(page);

      console.log(this.ActiveGrades);
      const gradeObj = this.ActiveGrades.find(
        (grade) => grade.Name === leagueName
      );
      logger.info(
        `gradeObj: ${JSON.stringify(gradeObj)}, leagueName: ${leagueName}`
      );
      return gradeObj?.ID !== undefined ? gradeObj.ID : false;
    } catch (error) {
      logger.error("Error getting grade ID:", error);
      throw error;
    }
  } */