/** 
 * SOLID APPROVED  
 * DO NOT ADJUST UNLESS ERROR IN CODE
*/

const logger = require("../../Utils/logger");

class getCompetitions {
  constructor(account) {
    this.url = account.attributes.associations.data[0].attributes.href;
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async setup() {
    logger.debug(`Fetching competitions for Association ${this.url}`);

    const page = await this.browser.newPage();

    try {
      const competitions = await this.fetchCompetitions(page, this.url);

      if (competitions.length === 0) {
        logger.warn(`No competitions found for Association ${this.url}`);
        return false;
      }

      return competitions;
    } catch (error) {
      logger.error(`Error fetching competitions for Association ${this.url}:`, error);
      return false;
    } finally {
      await page.close();
    }
  }

  async fetchCompetitions(page, url) {
    logger.debug(`Checking competitions for ${url}`);

    await page.goto(url);
    await page.waitForSelector(".sc-3lpl8o-5.dznirp");

    const competitions = await page.evaluate(() => {
      const seasonOrgs = Array.from(
        document.querySelectorAll(".sc-3lpl8o-5.dznirp")
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

  async dispose() {
    this.url = null;
    this.browser = null;
  }
}

module.exports = getCompetitions;
