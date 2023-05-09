const logger = require("../../Utils/logger");

class GetTeams {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async setup(competition) {
    try {
      this.page = await this.browser.newPage();
      const grades = competition.attributes.grades.data;
      const allTeamData = [];

      for (const item of grades) {
        logger.info(`Processing item with id ${item.id}`);

        const url = item.attributes.url;
        logger.info(`Navigating to ${url}/ladder`);
        await this.page.goto(`${url}/ladder`);

        const teams = await this.getTeamNamesAndUrls(this.page);
        const teamData = teams.map((team) => ({
          ...team,
          competition: [competition.id],
          grade: [item.id],
        }));

        allTeamData.push(...teamData);

        logger.info(`Finished processing item with id ${item.id}`);
      }
      logger.info("All team data processed successfully");
      return allTeamData;
    } catch (err) {
      logger.error("Error occurred while processing team data:", err);
      throw err;
    }
  }

  async getTeamNamesAndUrls(page) {
    try {
      const teamSelector =
        "table.d3hddp-2.jyUxWY > tbody > tr > td:nth-child(2) > a";

      const teams = await page.$$eval(teamSelector, (links) =>
        links.map((link) => {
          const href = link.getAttribute("href");
          const teamID = href.split("/").pop();
          return {
            teamName: link.innerText.trim(),
            href: href,
            teamID: teamID,
          };
        })
      );

      return teams;
    } catch (err) {
      logger.error("Error occurred while getting team names and URLs:", err);
      throw err;
    }
  }

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

module.exports = GetTeams;
