const logger = require("../../Utils/logger");

class TeamProcessor {
  constructor(browser) {
    this.browser = browser;
  }

  async processTeam(teamElement, club, competition, page) {
    logger.info(`"Processing club" ${club.data.id}`);
    
    try {
      const teamName = await teamElement.$eval("span:nth-child(1)", (el) => el.textContent);
      const gradeName = await teamElement.$eval("span:nth-child(2)", (el) => el.textContent);
      const gender = await teamElement.$eval("span:nth-child(3)", (el) => el.textContent);
      const age = await teamElement.$eval("span:nth-child(4)", (el) => el.textContent);
      const hrefElement = await teamElement.$("a");
      const href = hrefElement ? await hrefElement.evaluate((el) => el.href) : null;
      logger.warn(`"Processing Team" ${teamName}`);
      //console.log("the error is on this href", href)
      if (href) {
        const newPage = await this.browser.newPage();
      await newPage.goto(href);

      let gradeLink = null;
      try {
        await newPage.waitForSelector(".sc-crzoUp.lebimc.button", { timeout: 5000 });
        const gradeLinkElement = await newPage.$(".sc-crzoUp.lebimc.button");
        gradeLink = gradeLinkElement
          ? await gradeLinkElement.evaluate((el) => el.href)
          : null;
      } catch (error) { 
        logger.warn("Element .sc-crzoUp.lebimc.button not found. Proceeding without it.");
        // Add a return statement or handle the error appropriately
        // return null; // Uncomment this line if you want to stop processing this team
      }
  
        await newPage.close();
  
        const teamID = href.split("/").pop();
        const gradeLinkID = gradeLink ? gradeLink.split("/").pop() : null;
        return {
          teamName,
          gradeName,
          gender,
          age,
          href,
          teamID,
          gradeLinkID: gradeLinkID ? [gradeLinkID] : [],
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
  
}

class GetClubTeams {
  constructor(href, browser) { 
    this.URL = href;
    this.browser = browser;
    this.teamProcessor = new TeamProcessor(browser);
  }

  async processCompetition(page, competitionData) {
    const {
      attributes: { competitionUrl, club, competition },
    } = competitionData;
    logger.info(`Processing competition URL: ${competitionUrl}`);
    try {
      await page.goto(competitionUrl);
      logger.info(`Navigated to competition URL: ${competitionUrl}`);
      
      await page.waitForSelector('[data-testid="teams-list"] > li');
      logger.info(`Found teams list on competition URL: ${competitionUrl}`);
      
      const teamList = await page.$$('[data-testid="teams-list"] > li');
      logger.info(`Retrieved ${teamList.length} team elements from competition URL: ${competitionUrl}`);

      const competitionTeams = await Promise.all(
        teamList.map(async (teamElement, index) => {
          if (index === 0) {
            return null;
          }
          return this.teamProcessor.processTeam(teamElement, club, competition, page);
        })
      );

      logger.info(`Processed ${competitionTeams.length} teams from competition URL: ${competitionUrl}`);
      return competitionTeams.filter((team) => team !== null);
    } catch (error) {
      logger.error(`Error processing competition URL: ${competitionUrl}`, error);
      throw error;
    }
  }

  async setup(competitionUrls) {
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

      logger.info(`Total teams processed: ${teams.length}`);
      return teams;
    } catch (error) {
      logger.error(`Error getting teams:`, error);
      //throw error;
    } finally {
      logger.error(`CLASS GetClubTeams: Page Closed!!`);
      await page.close();
    }
  }
}

module.exports = GetClubTeams;
