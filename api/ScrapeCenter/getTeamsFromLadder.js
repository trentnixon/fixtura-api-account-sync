/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const logger = require("../Utils/logger");
const BaseController = require("../../common/BaseController");
const qs = require("qs");
const fetcher = require("../Utils/fetcher");

class GetTeamsFromLadder extends BaseController {
  constructor(ACCOUNT, URLS) {
    super(); // Add this line
    this.ACCOUNTID = ACCOUNT.ACCOUNTID;
    this.ACCOUNTTYPE = ACCOUNT.ACCOUNTTYPE;
    this.dependencies = require("../../common/dependencies");
    this.URLS = URLS;
    //this.teamProcessor = new TeamProcessor(this.ACCOUNTID);
  }

  async processGrade(grade) {
    logger.info(`TRY Processing item with id ${grade.id}`);
    const page = await this.browser.newPage();
    const url = grade.url;
    try {
      logger.info(`Navigating to ${url}/ladder`);
      await page.goto(`${url}/ladder`);

      const teams = await this.getTeamNamesAndUrls(page); 
      const teamData = teams.map((team) => ({
        ...team,
        competition: [grade.compID],
        grades: [grade.id],
      }));

      logger.info(`Finished processing item with id ${grade.id}`);

      return teamData;
    } catch (err) {
      logger.error(`Error processing competition URL: ${url}`, error);
    } finally {
      logger.warn(`Func processCompetition: Page Closed!!`);
      await page.close();
    }
  }

  async getTeamNamesAndUrls(page) {
    try {
      const teamSelector =
        "table.d3hddp-2.jyUxWY > tbody > tr > td:nth-child(2) > a";
  
      const links = await page.$$(teamSelector);
      const teams = [];
  
      for (const link of links) {
        const href = await page.evaluate(el => el.getAttribute('href'), link);
        const teamID = href.split("/").pop();
        console.log(href)
        const splitUrl = href.split('/');
        const STRAPIID = splitUrl[4];
        
        const query = qs.stringify(
          {
            filters: {
              PlayHQID: {
                $eq: STRAPIID,
              },
            },
          },
          {
            encodeValuesOnly: true,
          }
        );
  
        const response = await fetcher(`clubs?${query}`);
        //console.log("CLUB :: response");
        //console.log(response[0].id);
        
        const teamName = await page.evaluate(el => el.innerText.trim(), link);
  
        let teamObj = {
          teamName: teamName,
          href: href,
          teamID: teamID
        };
        
        if (response[0]?.id !== undefined) {
          teamObj.club = [response[0].id];
        }
        
        teams.push(teamObj);
      }
  
      return teams;
    } catch (err) {
      logger.error("Error occurred while getting team names and URLs:", err);
      throw err;
    }
  }


  async LoopURLS() {
    try {
      const allTeamData = [];

      for (const item of this.URLS) {
        const teamData = await this.processGrade(item);
        allTeamData.push(...teamData);
      }
      logger.info("All team data processed successfully");
      return allTeamData;
    } catch (error) {
      logger.error(`Error getting teams:`, error);
      //throw error;
    }
  }

  async setup() {
    console.log("Fetch Teams");
    try {
      await this.initDependencies(this.ACCOUNTID); // Call the initDependencies method from the BaseController
      const result = await this.LoopURLS();
      return result;
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

module.exports = GetTeamsFromLadder;
