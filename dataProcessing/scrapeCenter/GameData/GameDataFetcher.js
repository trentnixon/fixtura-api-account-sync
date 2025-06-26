const logger = require("../../../src/utils/logger");
const moment = require("moment");

const {
  scrapeRound,
  scrapeDate,
  scrapeStatus,
  scrapeTypeTimeGround,
  scrapeScoreCardInfo,
  scrapeTeamsInfo,
  isByeMatch,
} = require("./utils/ScrapeItems");

class GameDataFetcher {
  constructor(page, href, gradeID) {
    this.page = page;
    this.href = href;
    this.gradeID = gradeID;
    // XPath to locate game data on the web page
    this.xpath =
      "/html/body/div/section/main/div/div/div[1]/section/section/div/ul/li";
  }

  async fetchGameData() {
    try {
      await this.navigateToUrl();
      await this.waitForPageLoad();
      return await this.getGameDetails();
    } catch (error) {
      // Improved error logging with additional context
      logger.error(
        `Error fetching game data from URL: ${this.href} in fetchGameData method`,
        { error }
      );
      throw error;
    }
  }

  async getGameDetails() {
    try {
      console.log(`[getGameDetails] Fetching data from URL: ${this.href}`);
      const matchList = await this.page.$$(`xpath/${this.xpath}`); // Fetch match elements using XPath
      const gameData = [];

      for (const matchElement of matchList) {
        const gameDetails = await this.extractMatchDetails(matchElement);
        if (gameDetails) gameData.push(gameDetails);
      }

      return gameData;
    } catch (error) {
      logger.error("Error extracting game details in getGameDetails method", {
        error,
      });
      throw error;
    }
  }

  // NOTE This class changes 'div.sc-fnpp5x-0.sc-fnpp5x-5.boRXYi'
  // Find a better way to grab this data!
  async extractMatchDetails(matchElement) {
    try {
      console.log("[try to extractMatchDetails]");
      // where is this div?
      const gameDivs = await matchElement.$$("div.sc-1pr338c-0.cNVAcP");
      const gameDetails = [];

      for (const gameDiv of gameDivs) {
        if (await isByeMatch(gameDiv)) {
          gameDetails.push({ status: "bye" });
          continue; // Skip to the next iteration for bye matches
        }

        // Extracting various game details
        const date = await scrapeDate(gameDiv);
        const dateObj = moment(date, "dddd, DD MMMM YYYY").toDate();

        const round = await scrapeRound(gameDiv);
        console.log("[round]", round);
        const { type, time, ground, dateRangeObj, finalDaysPlay } =
          await scrapeTypeTimeGround(gameDiv);
        const status = await scrapeStatus(gameDiv);
        const { urlToScoreCard, gameID } = await scrapeScoreCardInfo(gameDiv);
        const teams = await scrapeTeamsInfo(gameDiv);

        // Consolidating extracted details
        gameDetails.push({
          grade: [this.gradeID],
          round,
          date,
          dayOne: dateObj,
          type,
          time,
          ground,
          dateRangeObj,
          finalDaysPlay,
          status,
          urlToScoreCard,
          gameID,
          teams: [],
          teamHomeID: teams[0].id,
          teamAwayID: teams[1].id,
          teamHome: teams[0].name,
          teamAway: teams[1].name,
        });
      }

      //console.log("[gameDetails]", gameDetails);

      return gameDetails;
    } catch (error) {
      logger.error(
        "Error extracting match details in extractMatchDetails method",
        { error }
      );
      throw error;
    }
  }

  // Helpers for navigation and page loading

  async navigateToUrl() {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Set timeout to 10 seconds (10000 milliseconds)
        await this.page.goto(this.href, {
          timeout: 30000,
          waitUntil: "domcontentloaded",
        });
        return;
      } catch (error) {
        // Log error using logger for consistency
        logger.error(
          `Attempt ${attempt} - Navigating to URL (${this.href}) failed in navigateToUrl:`,
          { error }
        );
        if (attempt === maxRetries) throw error;
        // Wait 2 seconds before retrying
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  async waitForPageLoad() {
    try {
      await this.page.waitForSelector('li[data-testid="games-on-date"]', {
        timeout: 10000,
      });
    } catch (error) {
      console.error(
        `Waiting for page load failed: ${error}: This could be due to the Class in on the page changing. Check value in GameDataFetcher.js`
      );
      // Handle the timeout or selector not found error
    }
  }
}

module.exports = GameDataFetcher;

// Developer Notes:
// - Uses Puppeteer for web scraping.
// - XPath and selectors should be updated as per target web page structure changes.
// - Designed for robust data extraction with error handling.

// Future Improvements:
// - Consider adding more comprehensive error handling for network issues.
// - Explore options for parallel data extraction to enhance performance.
// - Implement a retry mechanism for transient errors during data fetching.
