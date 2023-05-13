// Assign
const assignTeamToGameData = require("./assignTeamGameData");
// Utils
const logger = require("../../Utils/logger");
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

class getTeamsGameData {
  constructor(TEAMS) {
    this.TEAMS = TEAMS.data;
    this.browser = null;
    this.page = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async ProcessGame(matchList, team, GradeID) {
    const teamMatches = [];

    for (const matchElement of matchList) {
      try {
        const byeSelector = await matchElement.$(".sc-jrsJCI.gcJhbP");
        if (byeSelector) {
          teamMatches.push({ status: "bye" });
          continue;
        }

        /* ROUND *********** */
        const round = await ScrapeRound(matchElement, SELECTORS.ROUND.General);

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

        teamMatches.push({
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
        });
        await this.page.evaluate((el) => el.remove(), matchElement);
      } catch (error) {
        logger.error(
          `Error processing match for team ${team.teamName} (Index ${teamMatches.length}):`
        );
        logger.error(error);
        teamMatches.push(null);
      }
    }

    return teamMatches;
  }

  findGradeId(array, gradeId) {
    for (const item of array) {
      if (item.attributes.gradeId === gradeId) {
        return item.id;
      }
    }
    return null;
  }

  async LoopTeams() {
    let teamIndex = 0;
    //const assignGamesToStrapi = new assignTeamToGameData();
    try {
      for (const { id, attributes: team } of this.TEAMS) {
        logger.info(`Processing team ${team.teamName} (Index ${teamIndex})...`);
        logger.info(`on playHQ URL ${team.href}`);

        // Navigate to team page
        await this.page.goto(`https://www.playhq.com${team.href}`);

        // Wait for the match list to be rendered
        await this.page.waitForSelector(
          ".fnpp5x-0.fnpp5x-4.gJrsYc.jWGbFY,.sc-bqGHjH.sc-dlMBXb.blmUXq.jAJvWi"
        );
        await this.page.waitForTimeout(1000);

        const gradeIdSelector = "a.sc-crzoUp.lebimc.button";
        const gradeId = await this.page.$eval(gradeIdSelector, (element) => {
          const href = element.getAttribute("href");
          return href.split("/").pop();
        });

        let gradeIdFromPage = this.findGradeId(team.grades.data, gradeId);
        // Get the match list
        let matchList = await this.page.$$(".fnpp5x-0.fnpp5x-4.gJrsYc.jWGbFY");

        // Process the games on the page
        let GAMEDATA = await this.ProcessGame(matchList, team, gradeIdFromPage);

        let validMatches = GAMEDATA.filter((match) => match !== null);

 
        // Clear the accumulated data
        validMatches = null;
        GAMEDATA = null;
        matchList = null;
        teamIndex++;
      }
      return true;
    } catch (error) {
      logger.error("Error getting team game data:", error);
      throw error;
    }
  }
  async *processTeamMatches() {
    for (const { id, attributes: team } of this.TEAMS) {
      logger.info(`Processing team ${team.teamName}...`);
      logger.info(`on playHQ URL ${team.href}`);
  
      // Navigate to team page
      await this.page.goto(`https://www.playhq.com${team.href}`);
  
      // Wait for the match list to be rendered
      await this.page.waitForSelector(
        ".fnpp5x-0.fnpp5x-4.gJrsYc.jWGbFY,.sc-bqGHjH.sc-dlMBXb.blmUXq.jAJvWi"
      );
      await this.page.waitForTimeout(1000);
  
      const gradeIdSelector = "a.sc-crzoUp.lebimc.button";
      const gradeId = await this.page.$eval(gradeIdSelector, (element) => {
        const href = element.getAttribute("href");
        return href.split("/").pop();
      });
  
      let gradeIdFromPage = this.findGradeId(team.grades.data, gradeId);
      // Get the match list
      let matchList = await this.page.$$(".fnpp5x-0.fnpp5x-4.gJrsYc.jWGbFY");
  
      // Process the games on the page
      let GAMEDATA = await this.ProcessGame(
        matchList,
        team,
        gradeIdFromPage
      );
  
      yield GAMEDATA;
    }
  }
  
async setup() {
  try {
    this.page = await this.browser.newPage();

    const uploader = new assignTeamToGameData();
    for await (const teamMatches of this.processTeamMatches()) {
      const validMatches = teamMatches.filter((match) => match !== null);
      await uploader.setup(validMatches);
    }

    return true;
  } catch (err) {
    logger.error("Error setting up getTeamsGameData:", err);
    throw err;
  }
}

  /* async setup() {
    try {
      this.page = await this.browser.newPage();
      await this.LoopTeams();
      return true;
    } catch (err) {
      logger.error("Error setting up getTeamsGameData:", err);
      throw err;
    }
  } */

  async dispose() {
    if (this.page) {
      try {
        await this.page.close();
        logger.info("Page closed successfully");
      } catch (err) {
        logger.error("Error closing page:", err);
      }
    }
  }
}

module.exports = getTeamsGameData;

/* *********************************************************** */
// scrape FUNCS
/* *********************************************************** */

const Find_Item = async (matchElement, SELECTOR) => {
  try {
    return await matchElement.$eval(SELECTOR, (el) => el.textContent.trim());
  } catch (error) {
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
    return await matchElement.$eval(SELECTOR, (el) => el.getAttribute("href"));
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const ScrapeTeams = async (matchElement, SELECTOR) => {
  return await matchElement.$$eval(SELECTOR, (anchors) => {
    return anchors.map((a) => {
      const name = a.textContent.trim();
      const url = a.getAttribute("href");
      const id = url.split("/").pop();
      return { name, id };
    });
  });
};

const ScrapeTime = async (matchElement, SELECTORS) => {
  const timeSelector = await Find_Item(matchElement, SELECTORS.General);
  const timeCancelledSelector = await Find_Item(
    matchElement,
    SELECTORS.Cancelled
  );

  if (timeCancelledSelector) {
    return typeSelector ? typeSelector : "";
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
