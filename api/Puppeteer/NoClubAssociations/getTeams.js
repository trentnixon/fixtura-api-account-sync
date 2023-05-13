/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const logger = require("../../Utils/logger");

class GetTeams {
  constructor(browser) {
    this.browser = browser;
    this.page = null;
  }

  async setup(competition) {
    try {
      this.page = await this.browser.newPage();
      const grades = competition.attributes.grades.data;
      const allTeamData = [];

      for (const item of grades) {
        const teamData = await this.processGrade(item, competition.id);
        allTeamData.push(...teamData);
      }
      logger.info("All team data processed successfully");
      return allTeamData;
    } catch (err) {
      logger.error("Error occurred while processing team data:", err);
      throw err;
    } finally {
      await this.dispose();
    }
  }

  async processGrade(grade, competitionId) {
    logger.info(`Processing item with id ${grade.id}`);
    const url = grade.attributes.url;
    logger.info(`Navigating to ${url}/ladder`);
    await this.page.goto(`${url}/ladder`);

    const teams = await this.getTeamNamesAndUrls();
    const teamData = teams.map((team) => ({
      ...team,
      competition: [competitionId],
      grades: [grade.id],
    }));

    logger.info(`Finished processing item with id ${grade.id}`);
    return teamData;
  }

  async getTeamNamesAndUrls() {
    try {
      const teamSelector =
        "table.d3hddp-2.jyUxWY > tbody > tr > td:nth-child(2) > a";

      const teams = await this.page.$$eval(teamSelector, (links) =>
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