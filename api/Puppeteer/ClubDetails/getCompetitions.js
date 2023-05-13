/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 * This class is used by:
 * Clubs ALL
 *  Associations - has Clubs
 */
const logger = require("../../Utils/logger");

class GetCompetitions {
  constructor(href, browser) {
    this.URL = href;
    this.browser = browser;
  }

  async setup() {
    if (!this.browser) {
      throw new Error("Browser instance is not set.");
    }
    const page = await this.browser.newPage();
    page.on("console", (msg) => {
        console.log("PAGE LOG:", msg.text());
      });
      
    try {
      const competitions = await this.fetchCompetitions(page, this.URL);

      if (competitions.length === 0) {
        logger.info(`No competitions found for club ${this.URL}`);
        return false;
      }
      
      return competitions;
    } catch (error) {
      logger.error(`Error in setup method of GetCompetitions: ${error}`);
      throw error;
    } finally {
      logger.info(`CLASS GetCompetitions: Page Closed!!`);
      await page.close();
    }
  }

  async fetchCompetitions(page, url) {
    try {
      logger.info(`Checking this Competition ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      await page.waitForSelector(".sc-3lpl8o-5.dznirp", { timeout: 60000 });
      await page.screenshot({ path: "getCompetitions.png", fullPage: true });

      const competitions = await this.extractCompetitionsData(page);
      return competitions;
    } catch (error) {
      logger.error(`Error in fetchCompetitions method: ${error}`);
      throw error;
    }
  }

  async extractCompetitionsData(page) {
    return await page.evaluate(() => {
      const seasonOrgs = Array.from(
        document.querySelectorAll(".sc-3lpl8o-5.dznirp")
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
}

module.exports = GetCompetitions;
