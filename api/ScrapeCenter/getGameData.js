// Class/Element Monitoring File
/*
  How to Update:
  Should PlayHQ change in the future and the locations of the items needed to create or update a 
  game change here is what to do.

  1) Copy the new node structure from PlayHQ and copy it into ChatGPT
  2) prompt : Using only css selectors and no classes, provide me with a path to this position [.ele class]
  3) use ./UTILS/Constants to find the items needed and change the paths in that file to the new ones.

*/
const logger = require("../Utils/logger");
const BaseController = require("../../common/BaseController");
const moment = require("moment");
const Constants = require("./UTILS/Constants");
const {
  ScrapeRound,
  ScrapeDate,
  ScrapeGameURL,
  ScrapeTeams,
  ScrapeTime,
  ScrapeType,
  ScrapeGround,
  ScrapeStatus,
  scrapeTypeTimeGround
} = require("./UTILS/ScrapeItems");

class getTeamsGameData extends BaseController {
  constructor(ACCOUNT, TEAMS) {
    super();
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

 
  async getMatchList(page, xpath) {
    await page.waitForXPath(xpath);
    const parentElement = await page.$x(xpath);

    // Check the number of child div elements in the li node
    const childrenCount = await page.evaluate(
      (parentElement) => parentElement.children.length,
      parentElement[0]
    );

    let matchList = [];
    // Start from 2, as you mentioned
    for (let i = 2; i <= childrenCount; i++) {
      let childXPath = `${xpath}/div[${i}]`;
      let childElement = await page.$x(childXPath);
      matchList.push(childElement[0]);
    }
    return matchList;
  }

  checkString(value, defaultValue = "") {
    if (typeof value !== "string") {
      logger.error(
        `Unexpected type. Expected string but received ${typeof value}. Defaulting to default value.`
      );
      return defaultValue;
    }
    return value;
  }

  checkNumber(value, defaultValue = 0) {
    if (typeof value !== "number") {
      logger.error(
        `Unexpected type. Expected number but received ${typeof value}. Defaulting to default value.`
      );
      return defaultValue;
    }
    return value;
  }

  async ProcessGame(matchList, GradeID) {
    let teamMatches = [];

    for (let index = 0; index < matchList.length; index++) {
      try {
        const matchElement = matchList[index];
 
        // Bye condition
        const byeSelector = await matchElement.$(".sc-jrsJCI.gcJhbP");
        if (byeSelector) {
          teamMatches.push({ status: "bye" });
          continue;
        }

        /* ROUND */
        let round = await ScrapeRound(
          matchElement,
          Constants.SELECTORS.ROUND.General
        );
        round = this.checkString(round);

        /* DATE */
        let date = await ScrapeDate(
          matchElement,
          Constants.SELECTORS.DATE.General
        );
        date = this.checkString(date);
  
        const dateStr = date;
        const dateObj = moment(dateStr, "dddd, DD MMMM YYYY").toDate();
       
        let { type, time, ground } = await scrapeTypeTimeGround(matchElement, Constants.SELECTORS);
        type = this.checkString(type);
        time = this.checkString(time);
        ground = this.checkString(ground);


        /* STATUS */
        let status = await ScrapeStatus(
          matchElement,
          Constants.SELECTORS.STATUS
        );

        status = this.checkString(status);
        /* URLS */
        let urlToScoreCard = await ScrapeGameURL(
          matchElement,
          Constants.SELECTORS.URL.General
        );
        urlToScoreCard = this.checkString(urlToScoreCard);
        let gameID = urlToScoreCard
          ? urlToScoreCard.split("/").slice(-1)[0]
          : null;
        gameID = this.checkString(gameID);
        /* TEAMS */
        const teamNames = await ScrapeTeams(
          matchElement,
          Constants.SELECTORS.TEAMS.General
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
      } catch (error) {
        logger.error(
          `Error processing match  (Index ${index}) in ProcessGame:`,
          error
        );
      }
    }
    return teamMatches.filter((match) => match !== null);
  }

  async LoopGames() {
    let teamIndex = 0;
    let StoreGames = [];
    const page = await this.browser.newPage();
    const xPATH =
      "/html/body/div/section/main/div/div/div[1]/section/section/div/ul/li";

    try {
      for (const { teamName, id, href, grade } of this.TEAMS) {
        try {
          logger.info(
            `Processing team ${teamName} id ${id} (Index ${teamIndex} of ${this.TEAMS.length})...`
          );
          logger.info(`on playHQ URL ${href}`);

          // Navigate to team page
          console.log(`Search on URL : ${this.ensureHttp(href)}`);
          await page.goto(this.ensureHttp(href));
          await page.waitForTimeout(1000);

          // Get the match list
          const matchList = await this.getMatchList(page, xPATH);
          console.log("matchList:", matchList.length);

          // Process the games on the page
          const GAMEDATA = await this.ProcessGame(matchList, grade);

          const validMatches = GAMEDATA.filter((match) => match !== null);
         /*  console.log("validMatches");
          console.log(validMatches); */

          StoreGames.push(...validMatches);
          teamIndex++;
        } catch (error) {
          logger.error(
            `Error processing team ${teamName} on getGameData.js in the ScrapeCenter Folder`,
            error
          );
          teamIndex++;
        }
      }
      return StoreGames;
    } catch (error) {
      logger.error(`Error getting team game data:`, error);
    } finally {
      logger.info(`CLASS GetCompetitions: Page Closed!!`);
      await page.close();
    }
  }

  async setup() {
    console.log("Get Game Data : Setup called");
    try {
      await this.initDependencies(this.ACCOUNTID);
      const result = await this.LoopGames();
      console.log(`Length after scrape ${result.length}`);
      let filteredArray = result.filter(
        (v, i, a) => a.findIndex((t) => t.gameID === v.gameID) === i
      );
      console.log(`Length after Filter  ${filteredArray.length}`);
      return filteredArray;
    } catch (err) {
      logger.error("Error during setup:", err);
      await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
      logger.info("Set Account to False| ERROR ");
    } finally {
      await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
      logger.info("Set Account to False| Finally ");
      await this.dispose();
      logger.info("Dispose of items and Pupeteer | Finally");
    }
  }
}

module.exports = getTeamsGameData;


 /* //TYPE
        let type = await ScrapeType(matchElement, Constants.SELECTORS.TYPE);
        type = this.checkString(type);
        //TIME
        let time = await ScrapeTime(matchElement, Constants.SELECTORS.TIME);
        time = this.checkString(time);
        //Ground
        let ground = await ScrapeGround(
          matchElement,
          Constants.SELECTORS.GROUNDS
        );
        ground = this.checkString(ground); */

         /*  async getMatchList(page, xPath) {
    try {
      await page.waitForXPath(xPath);
      return await page.$x(xPath);
    } catch (error) {
      logger.error(`Error getting match list with xPath ${xPath}:`, error);
      return [];
    }
  } */