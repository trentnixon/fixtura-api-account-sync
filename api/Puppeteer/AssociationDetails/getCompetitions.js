const logger = require("../../Utils/logger");

class getCompetitions {
  constructor(Account) {
    this.URL = Account.attributes.associations.data[0].attributes.href;
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }
  async Setup() {
    logger.debug(`Fetching competitions for Association ${this.URL}`);

    const page = await this.browser.newPage();

    const Competitions = await this.fetchCompetitions(page, this.URL);

    if (Competitions.length === 0) {
      logger.warn(`No competitions found for Association ${this.URL}`);
      return false;
    }

    return Competitions;
  }

  async fetchCompetitions(page, url) {
    logger.debug(`Checking competitions for ${url}`);

    try {
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
            //console.log("competitionUrl", competitionUrl);
            return {
              competitionName,
              competitionUrl,
            };
          });
        });
      });

      logger.debug("Competitions fetched");
      return competitions;
    } catch (error) {
      logger.error(`Error fetching competitions from ${url}:`, error);
      return [];
    }
  }

  async dispose() {}
}

module.exports = getCompetitions;
