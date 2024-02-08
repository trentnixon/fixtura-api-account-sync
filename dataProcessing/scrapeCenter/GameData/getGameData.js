const logger = require("../../../src/utils/logger");
const GameDataFetcher = require("./GameDataFetcher");
const ProcessingTracker = require("../../services/ProcessingTracker");
const PuppeteerManager = require("../../puppeteer/PuppeteerManager");

class GetTeamsGameData {
  constructor(dataObj) {
    this.teams = dataObj.TEAMS;
    this.accountId = dataObj.ACCOUNT.ACCOUNTID;
    this.accountType = dataObj.ACCOUNT.ACCOUNTTYPE;
    this.puppeteerManager = new PuppeteerManager();
    this.processingTracker = ProcessingTracker.getInstance();
    this.domain = "https://www.playhq.com";
  }

  // Initialize Puppeteer and create a new page
  async initPage() {
    await this.puppeteerManager.launchBrowser();
    return this.puppeteerManager.browser.newPage();
  }

  async processGamesBatch(page, teamsBatch) {
    let storedGames = [];
    for (const team of teamsBatch) {
      //console.log(team)
      try {
        const { teamName, id, href, grade } = team;
        //console.log({ teamName, id, href, grade })
        logger.info(`Processing team ${teamName} id ${id}...`);
        const url = `${this.domain}${href}`; // Assuming full URL is provided in team.href
        const gameDataFetcher = new GameDataFetcher(page, url, grade);
        const gameData = await gameDataFetcher.fetchGameData();
        storedGames.push(...gameData.flat().filter((match) => match !== null)); // Flatten and filter the data
      } catch (error) {
        logger.error(`Error processing team game data: ${team.teamName}`, {
          error, 
        });
      }
    }
    return storedGames;
  }

  async fetchAndProcessTeamGameData(page, url) {
    try {
      const gameDataFetcher = new GameDataFetcher(page, url);
      return await gameDataFetcher.fetchGameData();
    } catch (error) {
      logger.error("Error fetching game data", { error, url });
      throw error;
    }
  }

  async setup() {
    try {
      const page = await this.initPage();
      let fetchedGames = await this.processGamesBatch(page, this.teams);
      fetchedGames = this.removeDuplicateGames(fetchedGames);
      if (fetchedGames.length === 0) {
        console.log("No game data found");
        //throw new Error("No game data found");
      }
      this.processingTracker.itemFound("games", fetchedGames.length);
      return fetchedGames;
    } catch (error) { 
      logger.error("Error in setup method", { error });
      throw error;
    } finally {
      await this.puppeteerManager.dispose();
    }
  }

  removeDuplicateGames(games) {
    return [...new Map(games.map((game) => [game.gameID, game])).values()];
  }
}

module.exports = GetTeamsGameData;

// Developer Notes:
// - This class uses Puppeteer to navigate and scrape game data from web pages.
// - Ensure that the GameDataFetcher is properly implemented to extract relevant game details.
// - removeDuplicateGames method prevents processing of duplicate game entries.

// Future Improvements:
// - Optimize Puppeteer usage for performance.
// - Enhance error handling to include retry mechanisms.
// - Investigate dynamic content handling on game data pages.
