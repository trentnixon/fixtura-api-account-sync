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
      logger.error(
        `Error in setup method of GetCompetitions in Folder ScrapCenter : ${error}`
      );
      logger.critical("An error occurred in ProcessComps", {
        file: "getCompetitions.js",
        function: "ProcessComps",
        error: error, // changed from err to error as err is not defined in this scope
      });
      throw error;
    } finally {
      logger.info(`CLASS GetCompetitions: Page Closed!!`);
      await page.close();
    }
  }

  async fetchCompetitionInAssociation(page, url) {
    logger.debug(
      `Checking competitions in fetchCompetitionInAssociation on URL :  ${url}`
    );

    await page.goto(url);
    await page.waitForSelector('[data-testid^="season-org-"]');

    const competitions = await page.evaluate(() => {
      const seasonOrgs = Array.from(
        document.querySelectorAll('[data-testid^="season-org-"]')
      );
      return seasonOrgs.flatMap(seasonOrg => {
        const competitionsList = Array.from(seasonOrg.querySelectorAll("h2"));
        return competitionsList.map(competition => {
          const competitionName = competition.textContent;
          const competitionUrl =
            competition.parentElement.querySelector("a")?.href;
          const statusElement =
            competition.parentElement.querySelector("div > span");
          const statusText = statusElement
            ? statusElement.textContent || "Not Found"
            : "Not Found";
          return {
            competitionName,
            competitionUrl,
            status: statusText,
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

      const blockedResources = [
        "https://faro-collector-prod-au-southeast-0.grafana.net/collect/2e623ddc3dc113ece7beab0eab12fe72",
      ];

      // Define a handler function
      const handler = request => {
        if (
          blockedResources.some(resource => request.url().includes(resource))
        ) {
          request.abort();
        } else {
          request.continue();
        }
      };

      // Enable request interception and set up the handler
      await page.setRequestInterception(true);
      page.on("request", handler);

      // Optionally handle or ignore page errors
      page.on("pageerror", err => {
        console.log("getCompetitions ::: Page error: " + err.toString());
        if (err instanceof EvalError) {
          console.log("Caught EvalError: " + err.toString());
        }
      });

      // Optionally handle or ignore other errors
      page.on("error", err => {
        console.log("Error: " + err.toString());
      });

      // Wait for an element defined by XPath to appear on the page
      await page.waitForSelector(
        "xpath///*[starts-with(@data-testid, 'season-org-')]"
      );

      // Use page.evaluate to access the document object in the browser context and
      // Use document.evaluate to select elements by XPath
      const seasonOrgsHTML = await page.evaluate(() => {
        const xpath = "//*[starts-with(@data-testid, 'season-org-')]";
        const snapshot = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        const seasonOrgs = [];
        for (let i = 0; i < snapshot.snapshotLength; i++) {
          seasonOrgs.push(snapshot.snapshotItem(i).outerHTML);
        }
        return seasonOrgs;
      });

      await page.screenshot({ path: "getCompetitions.png", fullPage: true });

      const competitions = await this.extractCompetitionsData(
        page,
        seasonOrgsHTML
      ); // If needed, adjust the extractCompetitionsData method to work with seasonOrgsHTML

      return competitions;
    } catch (error) {
      logger.error(`Error in fetchCompetitions method: ${error}`);
      logger.critical("An error occurred in fetchCompetitionsInClubs", {
        file: "getCompetitions.js",
        function: "fetchCompetitionsInClubs",
        error: error, // corrected from err to error
      });
      throw error;
    }
  }

  async extractCompetitionsData(page) {
    return await page.evaluate(() => {
      const results = [];

      const h2Elements = document.querySelectorAll("h2"); // Selecting all h2 elements which contain competition names.

      h2Elements.forEach(h2 => {
        const competitionName = h2.textContent || "Not Found";
        const ul = h2.nextElementSibling; // Assuming that ul is the next element after h2.

        if (ul && ul.tagName === "UL") {
          // Check if ul exists and is actually a ul tag.
          const liElements = ul.querySelectorAll("li"); // Selecting all li elements under the ul tag.

          liElements.forEach(li => {
            const aTag = li.querySelector("a");
            if (aTag) {
              const competitionUrl = aTag.href || "Not Found";
              const orgElement = h2.closest('[data-testid^="season-org-"]');
              const orgName = orgElement
                ? orgElement.querySelector("div > div > span.organisation-name")
                    ?.textContent || "Not Found"
                : "Not Found";
              const statusElement = li.querySelector("div > span");
              const statusText = statusElement
                ? statusElement.textContent || "Not Found"
                : "Not Found";
              results.push({
                competitionName,
                competitionUrl,
                orgName,
                status: statusText,
              });
            }
          });
        }
      });

      return results;
    });
  }

  async setup() {
    //console.log("TEST 1 . GetClubDetails Setup called");
    //console.log("this.ACCOUNTID", this.ACCOUNTID);

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
