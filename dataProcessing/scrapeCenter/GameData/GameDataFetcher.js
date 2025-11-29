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
        `Error fetching game data from URL: ${this.href} in fetchGameData method, returning empty array`,
        { error: error.message, url: this.href }
      );
      // Return empty array instead of throwing - allows processing to continue
      return [];
    }
  }

  async getGameDetails() {
    try {
      logger.debug(`Fetching game details from URL: ${this.href}`);
      const matchList = await this.page.$$(`xpath/${this.xpath}`); // Fetch match elements using XPath
      const gameData = [];

      for (const matchElement of matchList) {
        try {
          const gameDetails = await this.extractMatchDetails(matchElement);
          if (gameDetails && Array.isArray(gameDetails)) {
            gameData.push(...gameDetails);
          } else if (gameDetails) {
            gameData.push(gameDetails);
          }
        } catch (elementError) {
          // Log error for this element but continue with next element
          logger.warn(
            `Error extracting details for match element, skipping to next`,
            { error: elementError.message, url: this.href }
          );
          continue;
        }
      }

      return gameData;
    } catch (error) {
      logger.error(
        "Error extracting game details in getGameDetails method, returning empty array",
        {
          error: error.message,
          url: this.href,
        }
      );
      // Return empty array instead of throwing - allows processing to continue
      return [];
    }
  }

  // NOTE This class changes 'div.sc-fnpp5x-0.sc-fnpp5x-5.boRXYi'
  // Find a better way to grab this data!
  async extractMatchDetails(matchElement) {
    try {
      // Extract game divs from match element
      const gameDivs = await matchElement.$$("div.sc-1pr338c-0.cNVAcP");
      const gameDetails = [];

      for (const gameDiv of gameDivs) {
        try {
          if (await isByeMatch(gameDiv)) {
            gameDetails.push({ status: "bye" });
            continue; // Skip to the next iteration for bye matches
          }

          // Extracting various game details
          const date = await scrapeDate(gameDiv);
          const dateObj = moment(date, "dddd, DD MMMM YYYY").toDate();

          const round = await scrapeRound(gameDiv);
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
        } catch (gameDivError) {
          // Log error for this game div but continue with next div
          logger.warn(
            `Error extracting details for game div, skipping to next`,
            { error: gameDivError.message, url: this.href }
          );
          continue;
        }
      }

      return gameDetails;
    } catch (error) {
      logger.error(
        "Error extracting match details in extractMatchDetails method, returning empty array",
        { error: error.message, url: this.href }
      );
      // Return empty array instead of throwing - allows processing to continue
      return [];
    }
  }

  // Helpers for navigation and page loading

  async navigateToUrl() {
    const maxRetries = 3;
    const initialDelay = 500; // Start with 500ms
    const backoffMultiplier = 1.5; // Exponential backoff multiplier

    // Non-retryable errors - exit immediately
    const nonRetryableErrors = [
      "net::ERR_ABORTED", // 404, cancelled
      "net::ERR_NAME_NOT_RESOLVED", // DNS failure
      "net::ERR_INVALID_URL", // Invalid URL
      "Navigation failed because browser has disconnected", // Browser closed
    ];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Set timeout to 15 seconds for faster failure detection
        await this.page.goto(this.href, {
          timeout: 15000,
          waitUntil: "domcontentloaded",
        });
        return;
      } catch (error) {
        const errorMessage = error.message || "";

        // Check if error is non-retryable - exit immediately
        const isNonRetryable = nonRetryableErrors.some((err) =>
          errorMessage.includes(err)
        );

        if (isNonRetryable) {
          logger.warn(
            `Non-retryable error for ${this.href}, skipping retries: ${errorMessage}`,
            { url: this.href, error: errorMessage }
          );
          return; // Don't retry non-retryable errors
        }

        // Log error using logger for consistency
        logger.error(
          `Attempt ${attempt}/${maxRetries} - Navigating to URL (${this.href}) failed in navigateToUrl:`,
          { error: error.message, url: this.href }
        );

        if (attempt === maxRetries) {
          // After all retries failed, log but don't throw - allow processing to continue
          logger.warn(
            `All navigation retries exhausted for ${this.href}, continuing anyway`,
            { url: this.href }
          );
          return; // Don't throw - allow processing to continue
        }

        // Calculate exponential backoff delay
        const delay = Math.floor(
          initialDelay * Math.pow(backoffMultiplier, attempt - 1)
        );
        logger.debug(
          `Retrying navigation in ${delay}ms (attempt ${
            attempt + 1
          }/${maxRetries})`,
          { url: this.href, delay }
        );
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  async waitForPageLoad() {
    try {
      // Try multiple selectors as fallback in case page structure changed
      const selectors = [
        'li[data-testid="games-on-date"]',
        'li[data-testid*="games"]',
        "ul li[data-testid]",
        "body", // Fallback to ensure page loaded
      ];

      let found = false;
      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, {
            timeout: 5000, // Shorter timeout per selector
          });
          found = true;
          logger.debug(`Page loaded successfully using selector: ${selector}`, {
            url: this.href,
          });
          break;
        } catch (selectorError) {
          // Try next selector
          continue;
        }
      }

      if (!found) {
        // If all selectors fail, wait for any content to load
        try {
          await this.page.waitForSelector("body", { timeout: 5000 });
          logger.warn(
            `Primary selectors not found, but page loaded. Page structure may have changed.`,
            { url: this.href }
          );
        } catch (bodyError) {
          // Even body selector failed - page might be completely broken
          logger.warn(`Page load verification failed, but continuing anyway`, {
            url: this.href,
            error: bodyError.message,
          });
        }
      }
    } catch (error) {
      // Log error but never throw - allow processing to continue
      logger.error(
        `Waiting for page load failed: ${error.message}. This could be due to the page structure changing. Continuing anyway.`,
        { error: error.message, url: this.href }
      );
      // Don't throw - allow processing to continue even if selector fails
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
