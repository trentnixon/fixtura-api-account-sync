const logger = require("../../../src/utils/logger");
const CRUDOperations = require("../../services/CRUDOperations");

/**
 * TeamFetcher class is responsible for fetching team data from a given URL.
 * It navigates to the team ladder page and extracts team information.
 */
class TeamFetcher {
  constructor(page, teamInfo) {
    this.page = page;
    this.teamInfo = teamInfo; // Contains URL and additional data like competition ID and grade ID
    this.CRUDOperations = new CRUDOperations();
  }

  /**
   * Fetches teams by navigating to the ladder page of the team and extracting names and URLs.
   */
  async fetchTeams() {
    try {
      logger.info(`Navigating to ${this.teamInfo.href}/ladder`);
      await this.page.goto(`${this.teamInfo.href}/ladder`);
      return await this.getTeamNamesAndUrls();
    } catch (error) {
      logger.error(
        `Error in TeamFetcher.fetchTeams for URL: ${this.teamInfo.href}`,
        { error, method: "fetchTeams" }
      );
      throw error;
    }
  }

  /**
   * Extracts team names and URLs from the page.
   */
  async getTeamNamesAndUrls() {
    try {
      const teamXpath =
        "/html/body/div/section/main/div/div/div[1]/section/section/div/div/div/div/div[1]/table/tbody/tr/td[2]/a";
      const links = await this.page.$x(teamXpath);
      const teams = [];

      for (const link of links) {
        const href = await link.evaluate((el) => el.getAttribute("href"));
        const teamID = href.split("/").pop();
        const teamName = await link.evaluate((el) => el.innerText.trim());

        const clubID = await this.getClubIDFromHref(href);

        let teamObj = {
          teamName,
          href,
          teamID,
          competition: [this.teamInfo.compID],
          grades: [this.teamInfo.id],
          club: clubID ? [clubID] : [],
        };

        teams.push(teamObj);
      }

      return teams;
    } catch (error) {
      logger.error("Error in TeamFetcher.getTeamNamesAndUrls", {
        error,
        method: "getTeamNamesAndUrls",
      });
      throw error;
    }
  }

  /**
   * Extracts the club ID from the team's href attribute.
   */
  async getClubIDFromHref(href) {
   
    const playHQId = this.extractPlayHQId(href);
    console.log("extractPlayHQId from Href", href, playHQId)
    if (!this.isValidPlayHQId(playHQId)) {
        logger.error(`Invalid PlayHQ ID format: ${playHQId}, URL: ${href}`);
        return null;
    }
 
    try {
        return await this.CRUDOperations.fetchClubIdByPlayHQId(playHQId);
    } catch (error) {
        logger.error(`Error fetching club ID for PlayHQID: ${playHQId}`);
        console.log(error)
        return null;
    }
}

  // UTILS FUNCS
  extractPlayHQId(href) {
    const splitUrl = href.split("/");
    return splitUrl.length >= 5 ? splitUrl[4] : null;
  }
  
  isValidPlayHQId(playHQId) {
    const playHQIDPattern = /^[a-z0-9]{8}$/i;
    return playHQIDPattern.test(playHQId);
  }
}

module.exports = TeamFetcher;

// Developer Notes:
// - The class uses Puppeteer to navigate and scrape data from web pages.
// - Error handling is structured to provide clear information about where and why failures occur.

// Future Improvements:
// - Implement a more robust method for extracting and validating the PlayHQ ID.
// - Explore optimization techniques for faster page navigation and data extraction.
// - Consider implementing a caching mechanism to reduce redundant network calls for club data.
// - Investigate ways to handle paginated ladder pages, if applicable.
