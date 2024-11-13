const logger = require("../../../src/utils/logger");
const GameDataFetcher = require("./GameDataFetcher");
const ProcessingTracker = require("../../services/processingTracker");
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
    return await this.puppeteerManager.createPageInNewContext();
  }

  async processGamesBatch(page, teamsBatch) {
    console.log("Items in [teamsBatch]", teamsBatch.length);
    //throw new Error("THROW ERROR IN processGamesBatch");
    let storedGames = [];
    for (const team of teamsBatch) {
      try {
        const { teamName, id, href, grade } = team;

        const url = `${this.domain}${href}`; // Assuming full URL is provided in team.href
        logger.info(`Processing team ${teamName} id ${id} ${url}...`);
        const gameDataFetcher = new GameDataFetcher(page, url, grade);
        const gameData = await gameDataFetcher.fetchGameData();
        storedGames.push(...gameData.flat().filter(match => match !== null)); // Flatten and filter the data
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
      //console.log("fetchedGames ", fetchedGames);

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
    return [...new Map(games.map(game => [game.gameID, game])).values()];
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
