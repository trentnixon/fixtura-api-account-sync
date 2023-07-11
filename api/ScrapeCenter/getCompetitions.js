/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 * This class is used by:
 * Clubs ALL
 *  Associations - has Clubs
 */
// Class/Element Monitoring File
const logger = require("../Utils/logger");
const BaseController = require("../../common/BaseController"); 

class GetCompetitions extends BaseController {
  constructor(href, ACCOUNT) {
    super(); // Add this line
    this.URL = href;
    this.ACCOUNTID = ACCOUNT.ACCOUNTID;
    this.ACCOUNTTYPE = ACCOUNT.ACCOUNTTYPE;
    this.dependencies = require("../../common/dependencies"); 
  }

  async testClassSetup() {
    if (!this.browser) {
      logger.error(`ERROR: BROWSER MISSING`);
      return false;
    }
    if (!this.URL) {
      logger.error(`ERROR: URL MISSING`);

      return false;
    }
  }

  async ProcessComps() { 
    
    if (await this.testClassSetup()) return false;

    const page = await this.browser.newPage(); 

    page.on("console", (msg) => {
      console.log("PAGE LOG:", msg.text());
    });

    try {
      let competitions;
      if (this.ACCOUNTTYPE === "ASSOCIATION") {
        competitions = await this.fetchCompetitionInAssociation(page, this.URL);
      } else {
        competitions = await this.fetchCompetitionsInClubs(page, this.URL);
      }  
 
      if (competitions.length === 0) {
        logger.info(`No competitions found for club ${this.URL}`);
        return false;
      }
      return competitions;
    } catch (error) {
      logger.error(`Error in setup method of GetCompetitions in Folder ScrapCenter : ${error}`);
      logger.critical("An error occurred in ProcessComps", {
        file: "getCompetitions.js",
        function: "ProcessComps",
        error: err,
      });
      throw error;
    } finally {
      logger.info(`CLASS GetCompetitions: Page Closed!!`);
      await page.close();
    }
  }

  async fetchCompetitionInAssociation(page, url) {
    logger.debug(`Checking competitions in fetchCompetitionInAssociation on URL :  ${url}`);

    await page.goto(url);
    await page.waitForSelector('[data-testid^="season-org-"]');

    const competitions = await page.evaluate(() => {
      const seasonOrgs = Array.from(
        document.querySelectorAll('[data-testid^="season-org-"]')
      );
      return seasonOrgs.flatMap((seasonOrg) => {
        const competitionsList = Array.from(seasonOrg.querySelectorAll("h2"));
        return competitionsList.map((competition) => {
          const competitionName = competition.textContent;
          const competitionUrl =
            competition.parentElement.querySelector("a")?.href;
          return {
            competitionName,
            competitionUrl,
          };
        });
      });
    });

    logger.debug("Competitions fetched");
    return competitions;
  }

  async fetchCompetitionsInClubs(page, url) {
    try {
      logger.info(`Checking this Competition ${url}`);
      await page.goto(url);
      
      // Use page.evaluate to access the document object in the browser context.
      await page.evaluate(() => {
        return document.querySelectorAll('[data-testid^="season-org-"]');
      });
  
      await page.screenshot({ path: "getCompetitions.png", fullPage: true });
  
      const competitions = await this.extractCompetitionsData(page);
  
      return competitions;
    } catch (error) {
      logger.error(`Error in fetchCompetitions method: ${error}`);
      logger.critical("An error occurred in fetchCompetitionsInClubs", {
        file: "getCompetitions.js",
        function: "fetchCompetitionsInClubs",
        error: err,
      });
      throw error;
    }
  }
  

  async extractCompetitionsData(page) {
    return await page.evaluate(() => {
      const seasonOrgs = Array.from(
        document.querySelectorAll('[data-testid^="season-org-"]')
      );

      return seasonOrgs.flatMap((seasonOrg) => {
        const orgName = seasonOrg.querySelector(
          "div > div > span.organisation-name"
        ).textContent;

        const competitionsList = Array.from(seasonOrg.querySelectorAll("h2"));

        return competitionsList
          .filter((competition) => {
            // Check if the competition has the active selector or pending
            const completedSpan = Array.from(
              competition.parentElement.querySelectorAll("span")
            ).find(
              (span) =>
                span.textContent === "Active" ||
                span.textContent === "Pending" ||
                span.textContent === "Completed"
            );
            return completedSpan;
          })
          .map((competition) => {
            const competitionName = competition.textContent;
            const competitionUrl =
              competition.parentElement.querySelector("a").href;
            return {
              competitionName,
              competitionUrl,
              orgName,
            };
          });
      });
    });
  }

  async setup() {
    console.log("TEST 1 . GetClubDetails Setup called");
    console.log("this.ACCOUNTID", this.ACCOUNTID)
    try {
      await this.initDependencies(this.ACCOUNTID); // Call the initDependencies method from the BaseController
      const result = await this.ProcessComps(); 
      return result;
    } catch (err) { 
      logger.error("Error during setup:", err);
      logger.critical("An error occurred in setup", {
        file: "getCompetitions.js",
        function: "setup",
        error: err,
      });
      await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
      logger.info("Set Account to False| ERROR ");
      /* await this.dependencies.createDataCollection(this.ACCOUNTID, {
        error: true,
      }); */
      logger.info("Create a Data Entry | ERROR");
    } finally {
      await this.dependencies.changeisUpdating(this.ACCOUNTID, false);
      logger.info("Set Account to False| Finally ");
     /*  await this.dependencies.createDataCollection(this.ACCOUNTID, {
        error: true,
      }); */
      logger.info("Create a Data Entry | Finally");
      await this.dispose();
      logger.info("Dispose of items and Pupeteer | Finally");
    }
  }
}

module.exports = GetCompetitions;
