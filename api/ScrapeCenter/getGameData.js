const logger = require("../Utils/logger");
const BaseController = require("../../common/BaseController");
const { ProcessGameModule } = require("./UTILS/ProcessGameModule");
const { ensureHttp, getMatchList } = require("./UTILS/UtilityFunctions");

class getTeamsGameData extends BaseController {
  constructor(ACCOUNT, TEAMS) {
    super();
    this.TEAMS = TEAMS;
    this.ACCOUNTID = ACCOUNT.ACCOUNTID;
    this.ACCOUNTTYPE = ACCOUNT.ACCOUNTTYPE;
    this.dependencies = require("../../common/dependencies");
  }
 
  async LoopGamesBatch(teamsBatch) {
    let StoreGames = [];
    const page = await this.browser.newPage();
    const xPATH = "/html/body/div/section/main/div/div/div[1]/section/section/div/ul/li";

    for (let teamIndex = 0; teamIndex < teamsBatch.length; teamIndex++) {
      const { teamName, id, href, grade } = teamsBatch[teamIndex];
      logger.info(`Processing team ${teamName} id ${id} (Index ${teamIndex} of ${teamsBatch.length})...`);
      await this.processTeam(page, href, grade, StoreGames, xPATH);
    }

    await page.close();
    logger.info(`CLASS GetCompetitions: Page Closed!!`);
    return StoreGames;
  }

  async processTeam(page, href, grade, StoreGames, xPATH) {
    try {
      logger.info(`on playHQ URL ${href}`);
      await page.goto(ensureHttp(href));
      await page.waitForTimeout(1000);
  
      const matchList = await getMatchList(page, xPATH);
      //console.log("matchList:", matchList.length);
  
     
      const gameData = await ProcessGameModule(matchList, grade);
      StoreGames.push(...gameData.filter((match) => match !== null));
    } catch (error) {
      logger.error(`Error processing team on getGameData.js`, error);
      logger.critical("An error occurred in processTeam", {
        file: "getGameData.js",
        function: "processTeam",
        error: error,
      });
    }
  }
  

  async setupBatch(teamsBatch) {
    console.log(teamsBatch)
   
    try {
      await this.initDependencies(this.ACCOUNTID);
      const result = await this.LoopGamesBatch(teamsBatch);
      //console.log(result)

      return this.filterDuplicates(result);
    } catch (err) {
      logger.error("Error during setupBatch:", err);
      this.handleSetupBatchError(err);
    } finally {
      await this.finalizeBatch();
    }
  }

  filterDuplicates(games) {
    console.log(`Length after scrape ${games.length}`);
    const filtered = games.filter((v, i, a) => a.findIndex((t) => t.gameID === v.gameID) === i);
    console.log(`Length after Filter ${filtered.length}`);
    return filtered;
  }

  handleSetupBatchError(err) {
    logger.critical("An error occurred in setupBatch", {
      file: "getGameData.js",
      function: "setupBatch",
      error: err,
    });
    this.dependencies.changeisUpdating(this.ACCOUNTID, false);
    logger.info("Set Account to False| ERROR ");
  }

  async finalizeBatch() {
    await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
    logger.info("Set Account to False| Finally ");
    await this.dispose();
    logger.info("Dispose of items and Pupeteer | Finally");
  }
}

module.exports = getTeamsGameData;
