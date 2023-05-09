const logger = require("../../Utils/logger");

class getCompetitions {
  constructor(href) {
    this.URL = href;
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }
  async Setup() {
    if (!this.browser) {
      throw new Error("Browser instance is not set.");
    }

    try {
      const page = await this.browser.newPage();
      page.on("console", (msg) => {
        console.log("PAGE LOG:", msg.text());
      });
      const Competitions = await this.fetchCompetitions(page, this.URL);

      if (Competitions.length === 0) {
        logger.info(`No competitions found for club ${this.URL}`);
        await page.close();
        return false;
      }

      await page.close();
      return Competitions;
    } catch (error) {
      logger.error(`Error in Setup method of getCompetitions: ${error}`);
      throw error;
    }
  }

  async fetchCompetitions(page, url) {
    try {
      logger.info(`Checking this Competition ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      await page.waitForSelector(".sc-3lpl8o-5.dznirp", { timeout: 60000 });
      await page.screenshot({ path: "getCompetitions.png" });
 
      const competitions = await page.evaluate(() => {
        const seasonOrgs = Array.from(
          document.querySelectorAll(".sc-3lpl8o-5.dznirp")
        );
      
        return seasonOrgs.flatMap((seasonOrg) => {
          const orgName = seasonOrg.querySelector("div > div > span.organisation-name").textContent;
      
          const competitionsList = Array.from(seasonOrg.querySelectorAll("h2"));
      
          return competitionsList
            .filter((competition) => {
              // Check if the competition has the active selector
              const completedSpan = Array.from(competition.parentElement.querySelectorAll("span")).find((span) => span.textContent === 'Completed');
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
      

      return competitions;
    } catch (error) {
      logger.error(`Error in fetchCompetitions method: ${error}`);
      throw error;
    }
  }
}

module.exports = getCompetitions;
