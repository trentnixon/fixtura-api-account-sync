const logger = require("../../Utils/logger");

class getClubTeams {
  constructor(href) {
    this.URL = href;
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }


  async processTeam(teamElement, club, competition, page) {
    try {
      const teamName = await teamElement.$eval("span:nth-child(1)", (el) => el.textContent);
      const gradeName = await teamElement.$eval("span:nth-child(2)", (el) => el.textContent);
      const gender = await teamElement.$eval("span:nth-child(3)", (el) => el.textContent);
      const age = await teamElement.$eval("span:nth-child(4)", (el) => el.textContent);
      const hrefElement = await teamElement.$("a");
      const href = hrefElement ? await hrefElement.evaluate((el) => el.href) : null;
  
      if (href) {
        const newPage = await this.browser.newPage();
        await newPage.goto(href);
  
        await newPage.waitForSelector(".sc-crzoUp.lebimc.button");
        const gradeLinkElement = await newPage.$(".sc-crzoUp.lebimc.button");
        const gradeLink = gradeLinkElement
          ? await gradeLinkElement.evaluate((el) => el.href)
          : null;
  
        await newPage.close();
  
        const teamID = href.split("/").pop();
        const gradeLinkID = gradeLink.split("/").pop();
        //console.log("this is the teams gradeLinkID", gradeLinkID, teamName, teamID);
        return {
          teamName,
          gradeName,
          gender,
          age,
          href,
          teamID,
          gradeLinkID:[gradeLinkID],
          club: [club.data.id],
          competition: [competition.data.id],
        };
      } else {
        logger.error("Error processing team: Missing href for team");
        return null;
      }
    } catch (error) {
      logger.error(`Error processing team: ${competition.data.attributes.url}`, error);
      return null;
    }
  }
  

  async processCompetition(page, competitionData) {
    const {
      attributes: { competitionUrl, club, competition },
    } = competitionData;
    logger.info(`Processing competition URL: ${competitionUrl}`);
    await page.goto(competitionUrl);
    await page.waitForSelector('[data-testid="teams-list"] > li');
    const teamList = await page.$$('[data-testid="teams-list"] > li');

    const competitionTeams = await Promise.all(
      teamList.map(async (teamElement, index) => {
        if (index === 0) {
          return null;
        }
        return this.processTeam(teamElement, club, competition, page);
      })
    );

    return competitionTeams.filter((team) => team !== null);
  }

  async Setup(competitionUrls) {
    const page = await this.browser.newPage();
    try {
      const teams = [];

      for (const competitionData of competitionUrls) {
        const competitionTeams = await this.processCompetition(
          page,
          competitionData
        );
        teams.push(...competitionTeams);
      }

      return teams;
    } catch (error) {
      logger.error(`Error getting teams:`, error);
    } finally {
      await page.close();
    }
  }
}

module.exports = getClubTeams;
