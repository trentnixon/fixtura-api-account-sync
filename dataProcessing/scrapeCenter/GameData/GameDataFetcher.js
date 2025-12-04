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
      const navStartTime = Date.now();
      await this.navigateToUrl();
      const navDuration = Date.now() - navStartTime;
      logger.info(`[PARALLEL_GAMES] [NAV] Navigation complete: ${navDuration}ms`);

      const waitStartTime = Date.now();
      await this.waitForPageLoad();
      const waitDuration = Date.now() - waitStartTime;
      logger.info(`[PARALLEL_GAMES] [WAIT] Page load complete: ${waitDuration}ms`);

      const extractStartTime = Date.now();
      const result = await this.getGameDetails();
      const extractDuration = Date.now() - extractStartTime;
      logger.info(`[PARALLEL_GAMES] [EXTRACT] Extraction complete: ${extractDuration}ms (total: ${Date.now() - navStartTime}ms)`);
      return result;
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
    const waitStartTime = Date.now();
    const MAX_TOTAL_WAIT_TIME = 8000; // Fail fast after 8 seconds total (accounts for proxy latency)
    const QUICK_CHECK_TIMEOUT = 4000; // Quick check timeout (accounts for proxy routing + page load)
    const CONTENT_CHECK_TIMEOUT = 4000; // Content check timeout (accounts for proxy latency)
    const POLLING_INTERVAL = 100; // Faster polling (reduced from 200ms)

    try {
      // OPTIMIZED: Check multiple selectors in parallel with shorter timeouts
      // This reduces wait time from 8s+ to ~2s for most pages
      const fixtureListSelectors = [
        'li[data-testid="games-on-date"]',
        'li[data-testid*="games"]',
        "ul li[data-testid]",
      ];

      let fixtureListFound = false;
      let foundSelector = null;

      // Try selectors with shorter timeout - most pages load in 1-2 seconds
      for (const selector of fixtureListSelectors) {
        try {
          await this.page.waitForSelector(selector, {
            timeout: QUICK_CHECK_TIMEOUT, // Reduced from 8000ms to 2000ms
            visible: true,
          });
          fixtureListFound = true;
          foundSelector = selector;
          logger.debug(`Fixture list found using selector: ${selector}`, {
            url: this.href,
            waitTime: Date.now() - waitStartTime,
          });
          break;
        } catch (e) {
          // Check if we've exceeded max total wait time
          if (Date.now() - waitStartTime > MAX_TOTAL_WAIT_TIME) {
            logger.warn(
              `[PARALLEL_GAMES] [WAIT] Max wait time exceeded, failing fast`,
              {
                url: this.href,
                elapsed: Date.now() - waitStartTime,
                selector,
              }
            );
            throw new Error(
              `Page structure not found after ${MAX_TOTAL_WAIT_TIME}ms - likely page structure changed or empty page`
            );
          }
          continue;
        }
      }

      if (!fixtureListFound) {
        // Fail fast if selectors not found - don't wait unnecessarily
        const elapsed = Date.now() - waitStartTime;
        logger.warn(
          `[PARALLEL_GAMES] [WAIT] Primary fixture selectors not found after ${elapsed}ms - page structure may have changed or page is empty`,
          {
            url: this.href,
            elapsed,
            selectorsTried: fixtureListSelectors,
          }
        );
        // Quick check if body exists, then fail fast
        try {
          await this.page.waitForSelector("body", { timeout: 500 });
        } catch (e) {
          // Body doesn't exist - page didn't load
          throw new Error(`Page body not found - page may not have loaded`);
        }
        // Page loaded but structure doesn't match - return early (empty page is valid)
        return;
      }

      // OPTIMIZED: Check for game divs with shorter timeout and early exit
      // Step 2: Wait for the actual game divs to be present (the content we extract)
      const gameDivSelector = "div.sc-1pr338c-0.cNVAcP";
      let gameDivsFound = false;

      try {
        await this.page.waitForSelector(gameDivSelector, {
          timeout: QUICK_CHECK_TIMEOUT, // Reduced from 8000ms to 2000ms
          visible: true,
        });
        gameDivsFound = true;
        logger.debug(`Game divs found, fixture data structure is present`, {
          url: this.href,
          waitTime: Date.now() - waitStartTime,
        });
      } catch (gameDivError) {
        // Game divs might not exist if there are no fixtures - this is OK
        const elapsed = Date.now() - waitStartTime;
        logger.debug(
          `[PARALLEL_GAMES] [WAIT] Game divs not found (empty page or structure change) after ${elapsed}ms`,
          {
            url: this.href,
            elapsed,
            error: gameDivError.message,
          }
        );
        // Empty pages are valid - return early
        return;
      }

      // OPTIMIZED: Faster content check with shorter timeout and better polling
      // Step 3: Wait for fixture content to be fully rendered (but fail fast if not)
      try {
        await this.page.waitForFunction(
          () => {
            const gameDivs = document.querySelectorAll(
              "div.sc-1pr338c-0.cNVAcP"
            );
            if (gameDivs.length === 0) {
              return false;
            }
            // Check if at least one game div has content
            for (const div of gameDivs) {
              if (
                div.children.length > 0 ||
                (div.textContent && div.textContent.trim().length > 0)
              ) {
                return true; // Content found
              }
            }
            return false;
          },
          {
            timeout: CONTENT_CHECK_TIMEOUT, // Reduced from 10000ms to 3000ms
            polling: POLLING_INTERVAL, // Faster polling (100ms instead of 200ms)
          }
        );
        const totalWait = Date.now() - waitStartTime;
        logger.debug(`Fixture content is fully rendered`, {
          url: this.href,
          totalWaitTime: totalWait,
        });
      } catch (contentError) {
        // Content check failed - might be empty page or slow loading
        const elapsed = Date.now() - waitStartTime;
        logger.debug(
          `[PARALLEL_GAMES] [WAIT] Content check timeout after ${elapsed}ms (might be empty or still loading)`,
          {
            url: this.href,
            elapsed,
            error: contentError.message,
          }
        );
        // Don't wait longer - if content isn't ready after 3s, it's likely empty or broken
        // Return early to allow extraction to try anyway
      }

      const totalWait = Date.now() - waitStartTime;
      logger.debug(`Page load complete, fixtures should be ready for extraction`, {
        url: this.href,
        totalWaitTime: totalWait,
      });
    } catch (error) {
      const elapsed = Date.now() - waitStartTime;
      // Better error handling - fail fast for structure issues
      if (
        error.message.includes("structure") ||
        error.message.includes("not found") ||
        error.message.includes("timeout")
      ) {
        logger.warn(
          `[PARALLEL_GAMES] [WAIT] Page structure issue detected after ${elapsed}ms - failing fast`,
          {
            error: error.message,
            url: this.href,
            elapsed,
            action: "Continuing with extraction attempt (may return empty results)",
          }
        );
        // Don't add extra delay - fail fast
        return;
      }

      // Other errors - log and continue
      logger.error(
        `[PARALLEL_GAMES] [WAIT] Waiting for page load failed after ${elapsed}ms: ${error.message}`,
        {
          error: error.message,
          url: this.href,
          elapsed,
        }
      );
      // Minimal delay for unexpected errors
      await new Promise((resolve) => setTimeout(resolve, 500));
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
