const logger = require("../../../src/utils/logger");
const moment = require("moment");
const OperationContext = require("../../utils/OperationContext");

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
    // Create operation context for better error tracking
    this.context = new OperationContext("fetchGameData", "games", {
      href,
      gradeID,
      pageUrl: page ? page.url() : null,
    });
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

        // Reset rate limit state on successful navigation
        const PuppeteerManager = require("../../puppeteer/PuppeteerManager");
        const puppeteerManager = PuppeteerManager.getInstance();
        puppeteerManager._resetRateLimitState();

        return;
      } catch (error) {
        const errorMessage = error.message || "";

        // Handle proxy errors (rate limits, auth failures) with context
        const PuppeteerManager = require("../../puppeteer/PuppeteerManager");
        const puppeteerManager = PuppeteerManager.getInstance();
        puppeteerManager._handleProxyError(error, this.page, this.context);

        // Check if error is non-retryable - exit immediately
        const isNonRetryable = nonRetryableErrors.some((err) =>
          errorMessage.includes(err)
        );

        if (isNonRetryable) {
          this.context.warn(
            `Non-retryable error, skipping retries`,
            {
              error: errorMessage,
              errorType: "non-retryable",
              attempt,
            }
          );
          return; // Don't retry non-retryable errors
        }

        // Log error with context
        this.context.error(
          `Navigation attempt ${attempt}/${maxRetries} failed`,
          error,
          {
            attempt,
            maxRetries,
            isLastAttempt: attempt === maxRetries,
          }
        );

        if (attempt === maxRetries) {
          // After all retries failed, log but don't throw - allow processing to continue
          this.context.warn(
            `All navigation retries exhausted, continuing anyway`,
            {
              totalAttempts: maxRetries,
            }
          );
          return; // Don't throw - allow processing to continue
        }

        // Calculate exponential backoff delay
        const delay = Math.floor(
          initialDelay * Math.pow(backoffMultiplier, attempt - 1)
        );
        this.context.debug(`Retrying navigation`, {
          delay,
          nextAttempt: attempt + 1,
          maxRetries,
        });
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  async waitForPageLoad() {
    try {
      // CRITICAL: Wait for the actual fixture list structure to be present AND loaded
      // The XPath used for extraction: /html/body/div/section/main/div/div/div[1]/section/section/div/ul/li
      // We need to wait for this structure AND ensure fixture content is rendered

      // Step 1: Wait for the fixture list container to exist and be visible
      const fixtureListSelectors = [
        'li[data-testid="games-on-date"]',
        'li[data-testid*="games"]',
        "ul li[data-testid]",
      ];

      let fixtureListFound = false;
      for (const selector of fixtureListSelectors) {
        try {
          await this.page.waitForSelector(selector, {
            timeout: 8000, // Increased timeout to allow content to load
            visible: true, // Ensure element is visible, not just in DOM
          });
          fixtureListFound = true;
          logger.debug(`Fixture list found using selector: ${selector}`, {
            url: this.href,
          });
          break;
        } catch (e) {
          // Try next selector
          continue;
        }
      }

      if (!fixtureListFound) {
        // Fallback: wait for body and log warning
        await this.page.waitForSelector("body", { timeout: 2000 });
        logger.warn(
          `Primary fixture selectors not found, but page loaded. Page structure may have changed.`,
          { url: this.href }
        );
        // Still add delay for content to potentially load
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return;
      }

      // Step 2: Wait for the actual game divs to be present (the content we extract)
      // These are the divs with class "sc-1pr338c-0.cNVAcP" that contain fixture details
      try {
        await this.page.waitForSelector("div.sc-1pr338c-0.cNVAcP", {
          timeout: 8000,
          visible: true, // Ensure game divs are visible and rendered
        });
        logger.debug(`Game divs found, fixture data structure is present`, {
          url: this.href,
        });
      } catch (gameDivError) {
        // Game divs might not exist if there are no fixtures, or page structure changed
        logger.debug(
          `Game divs not found (might be empty page or structure change)`,
          {
            url: this.href,
            error: gameDivError.message,
          }
        );
        // Don't throw - empty pages are valid, but still add delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return;
      }

      // Step 3: Wait for fixture content to be fully rendered
      // Check that game divs have actual content (not just empty divs)
      try {
        await this.page.waitForFunction(
          () => {
            const gameDivs = document.querySelectorAll(
              "div.sc-1pr338c-0.cNVAcP"
            );
            if (gameDivs.length === 0) {
              return false; // No game divs yet
            }
            // Check if at least one game div has content (has child elements or text)
            for (const div of gameDivs) {
              if (
                div.children.length > 0 ||
                (div.textContent && div.textContent.trim().length > 0)
              ) {
                return true; // At least one div has content
              }
            }
            return false; // Divs exist but no content yet
          },
          {
            timeout: 10000, // Wait up to 10 seconds for content to render
            polling: 200, // Check every 200ms
          }
        );
        logger.debug(`Fixture content is fully rendered`, { url: this.href });
      } catch (contentError) {
        // Content check failed - might be empty page or slow loading
        logger.debug(
          `Content check timeout (might be empty or still loading)`,
          {
            url: this.href,
            error: contentError.message,
          }
        );
        // Add delay to give content more time to load
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      logger.debug(`Page load complete, fixtures should be ready for extraction`, {
        url: this.href,
      });
    } catch (error) {
      // Log error but never throw - allow processing to continue
      logger.error(
        `Waiting for page load failed: ${error.message}. This could be due to the page structure changing. Continuing anyway.`,
        { error: error.message, url: this.href }
      );
      // Add a delay even on error to give content time to load
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
