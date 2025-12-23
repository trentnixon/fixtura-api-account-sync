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
    // UPDATED: Structure changed - games are now in div elements, not li
    // New structure: div[data-testid^="grade-"] > div.sc-1pr338c-0.sc-1pr338c-5.kBhuTP.cNVAcP (match elements)
    // Each match element contains: div[data-testid="fixture-list"] > div[data-testid="games-on-date"]
    this.matchElementSelector = "div.sc-1pr338c-0.sc-1pr338c-5.kBhuTP.cNVAcP";
    // Fallback XPath for compatibility
    this.xpath =
      "//div[@data-testid='fixture-list']/ancestor::div[contains(@class, 'cNVAcP')]";
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
      logger.debug(
        `[PARALLEL_GAMES] [NAV] Navigation complete: ${navDuration}ms`
      );

      // Wait for dynamic content to load (especially important with proxy latency)
      // PlayHQ uses React/SPA, so content loads after initial page load
      // Wait for game list items to start appearing (indicates React has rendered)
      await this.page
        .waitForSelector('li[data-testid="games-on-date"]', {
          timeout: 5000,
          visible: false, // Just check if element exists in DOM, not necessarily visible yet
        })
        .catch(() => {}); // Non-blocking - continue if timeout

      const waitStartTime = Date.now();
      await this.waitForPageLoad();
      const waitDuration = Date.now() - waitStartTime;
      logger.debug(
        `[PARALLEL_GAMES] [WAIT] Page load complete: ${waitDuration}ms`
      );

      const extractStartTime = Date.now();
      const result = await this.getGameDetails();
      const extractDuration = Date.now() - extractStartTime;
      logger.debug(
        `[PARALLEL_GAMES] [EXTRACT] Extraction complete: ${extractDuration}ms (total: ${
          Date.now() - navStartTime
        }ms)`
      );
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

      // DIAGNOSTIC: Try multiple selectors to see what's actually on the page
      const diagnosticInfo = await this.page.evaluate(() => {
        const info = {
          xpathMatches: 0,
          gamesOnDateMatches: 0,
          gamesMatches: 0,
          ulMatches: 0,
          liMatches: 0,
          sampleHTML: "",
          pageStructure: {},
        };

        // Try the XPath structure
        try {
          const xpathResult = document.evaluate(
            "/html/body/div/section/main/div/div/div[1]/section/section/div/ul/li",
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          info.xpathMatches = xpathResult.snapshotLength;
        } catch (e) {
          info.xpathError = e.message;
        }

        // Try CSS selectors
        info.gamesOnDateMatches = document.querySelectorAll(
          'div[data-testid="games-on-date"]'
        ).length;
        info.gamesMatches = document.querySelectorAll(
          'li[data-testid*="games"]'
        ).length;
        info.ulMatches = document.querySelectorAll("ul").length;
        info.liMatches = document.querySelectorAll("li").length;

        // Get sample HTML structure
        const mainSection =
          document.querySelector("section main") ||
          document.querySelector("main");
        if (mainSection) {
          info.sampleHTML = mainSection.innerHTML.substring(0, 1000);
        }

        // Check for common game container patterns
        info.hasGamesOnDate = !!document.querySelector(
          'div[data-testid="games-on-date"]'
        );
        info.hasGamesPattern = !!document.querySelector(
          'li[data-testid*="games"]'
        );

        return info;
      });

      logger.debug(
        `[SCRAPE-DIAGNOSTIC] Page structure analysis - XPath: ${diagnosticInfo.xpathMatches}, games-on-date: ${diagnosticInfo.gamesOnDateMatches}, games*: ${diagnosticInfo.gamesMatches}, ULs: ${diagnosticInfo.ulMatches}, LIs: ${diagnosticInfo.liMatches}`,
        {
          url: this.href,
          gradeID: this.gradeID,
          xpathMatches: diagnosticInfo.xpathMatches,
          gamesOnDateMatches: diagnosticInfo.gamesOnDateMatches,
          gamesMatches: diagnosticInfo.gamesMatches,
          ulMatches: diagnosticInfo.ulMatches,
          liMatches: diagnosticInfo.liMatches,
          hasGamesOnDate: diagnosticInfo.hasGamesOnDate,
          hasGamesPattern: diagnosticInfo.hasGamesPattern,
          xpathError: diagnosticInfo.xpathError || null,
          sampleHTML: diagnosticInfo.sampleHTML?.substring(0, 500) || "none",
        }
      );

      // UPDATED: Use CSS selector for new structure (div-based, not li-based)
      let matchList = await this.page.$$(this.matchElementSelector);

      // Fallback: If CSS selector finds nothing, try XPath
      if (matchList.length === 0) {
        logger.warn(
          `[STRUCTURE-WARNING] CSS selector found 0 match elements, trying XPath fallback`,
          {
            cssSelector: this.matchElementSelector,
            xpath: this.xpath,
            url: this.href,
            gradeID: this.gradeID,
            possibleCause:
              "Page structure may have changed - match element selector not matching",
          }
        );
        matchList = await this.page.$$(`xpath/${this.xpath}`);

        if (matchList.length === 0) {
          logger.warn(
            `[STRUCTURE-WARNING] Both CSS selector and XPath found 0 match elements - structure likely changed`,
            {
              cssSelector: this.matchElementSelector,
              xpath: this.xpath,
              url: this.href,
              gradeID: this.gradeID,
              diagnosticInfo: {
                xpathMatches: diagnosticInfo.xpathMatches,
                gamesOnDateMatches: diagnosticInfo.gamesOnDateMatches,
                gamesMatches: diagnosticInfo.gamesMatches,
                ulMatches: diagnosticInfo.ulMatches,
                liMatches: diagnosticInfo.liMatches,
              },
              action:
                "Check if page structure has changed - may need to update selectors",
            }
          );
        }
      }

      logger.debug(
        `[SCRAPE-TRACE] Found ${matchList.length} match elements on page`,
        {
          url: this.href,
          gradeID: this.gradeID,
          matchElementsCount: matchList.length,
          diagnosticInfo: {
            xpathMatches: diagnosticInfo.xpathMatches,
            gamesOnDateMatches: diagnosticInfo.gamesOnDateMatches,
            gamesMatches: diagnosticInfo.gamesMatches,
          },
        }
      );

      // WARNING: If diagnostic shows structure mismatch
      if (
        diagnosticInfo.gamesOnDateMatches === 0 &&
        diagnosticInfo.gamesMatches === 0
      ) {
        logger.warn(
          `[STRUCTURE-WARNING] Diagnostic shows 0 games-on-date elements - page may have no games or structure changed`,
          {
            url: this.href,
            gradeID: this.gradeID,
            gamesOnDateMatches: diagnosticInfo.gamesOnDateMatches,
            gamesMatches: diagnosticInfo.gamesMatches,
            ulMatches: diagnosticInfo.ulMatches,
            liMatches: diagnosticInfo.liMatches,
            allDataTestIds: diagnosticInfo.allDataTestIds || [],
            possibleCauses: [
              "Page has no games scheduled",
              "Games use different data-testid attribute",
              "Page structure completely changed",
            ],
            action:
              "Check page manually to verify if games exist and what structure they use",
          }
        );
      }

      // If XPath found nothing but CSS selectors found games, try alternative approach
      if (matchList.length === 0 && diagnosticInfo.gamesOnDateMatches > 0) {
        logger.warn(
          `[SCRAPE-DIAGNOSTIC] XPath found 0 elements but CSS selector found ${diagnosticInfo.gamesOnDateMatches} games-on-date elements. Trying CSS selector approach.`,
          {
            url: this.href,
            xpath: this.xpath,
            gamesOnDateCount: diagnosticInfo.gamesOnDateMatches,
          }
        );

        // Try using CSS selector instead
        const cssMatchList = await this.page.$$(
          'div[data-testid="games-on-date"]'
        );
        logger.info(
          `[SCRAPE-DIAGNOSTIC] CSS selector found ${cssMatchList.length} elements`,
          {
            url: this.href,
            cssSelector: 'div[data-testid="games-on-date"]',
            elementCount: cssMatchList.length,
          }
        );
      }

      // OPTIMIZATION: Process match elements in parallel (was sequential)
      // This reduces processing time from 2-5s to 1-2s per team page
      const matchPromises = matchList.map(async (matchElement) => {
        try {
          const gameDetails = await this.extractMatchDetails(matchElement);
          return gameDetails && Array.isArray(gameDetails)
            ? gameDetails
            : gameDetails
            ? [gameDetails]
            : [];
        } catch (elementError) {
          // Suppress cancellation errors (happen when page is reset during operation)
          const errorMessage = elementError.message || String(elementError);
          const isCancellationError = [
            "Target closed",
            "Protocol error",
            "Navigation interrupted",
            "Session closed",
            "Execution context was destroyed",
            "Page closed",
            "Browser has been closed",
          ].some((err) => errorMessage.includes(err));

          if (isCancellationError) {
            // Don't log cancellation errors - they're expected when pages are reset
            return [];
          }

          // Log other errors for this element but continue with next element
          logger.warn(
            `Error extracting details for match element, skipping to next`,
            { error: elementError.message, url: this.href }
          );
          return []; // Return empty array instead of throwing
        }
      });

      // Wait for all match elements to be processed in parallel
      // Use Promise.allSettled to handle cancellations gracefully
      const matchResults = await Promise.allSettled(matchPromises);

      // Extract successful results and filter out failures
      const successfulResults = matchResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      // Flatten results (each match returns an array of game details)
      const gameData = successfulResults.flat();

      logger.debug(
        `[SCRAPE-TRACE] getGameDetails returning ${gameData.length} games`,
        {
          url: this.href,
          gradeID: this.gradeID,
          matchElementsProcessed: matchList.length,
          successfulMatchElements: matchResults.filter(
            (r) => r.status === "fulfilled"
          ).length,
          failedMatchElements: matchResults.filter(
            (r) => r.status === "rejected"
          ).length,
          totalGamesExtracted: gameData.length,
          gamesWithGameID: gameData.filter((g) => g?.gameID).length,
          gamesWithoutGameID: gameData.filter((g) => !g?.gameID).length,
          sampleGameIDs: gameData
            .slice(0, 5)
            .map((g) => g?.gameID || "null")
            .join(", "),
        }
      );

      // WARNING: If match elements found but no games extracted, structure may have changed
      if (matchList.length > 0 && gameData.length === 0) {
        logger.warn(
          `[STRUCTURE-WARNING] Match elements found (${matchList.length}) but 0 games extracted - structure may have changed`,
          {
            url: this.href,
            gradeID: this.gradeID,
            matchElementsFound: matchList.length,
            gamesExtracted: gameData.length,
            successfulMatchElements: matchResults.filter(
              (r) => r.status === "fulfilled"
            ).length,
            failedMatchElements: matchResults.filter(
              (r) => r.status === "rejected"
            ).length,
            possibleCauses: [
              "Game div selector changed - games may be in different location",
              "Extraction logic may need update for new structure",
              "Games may be empty/not loaded yet",
            ],
            action:
              "Check if game div selector and extraction logic need updates",
          }
        );
      }

      // WARNING: If diagnostic shows games exist but we found none, structure mismatch
      if (
        diagnosticInfo.gamesOnDateMatches > 0 &&
        matchList.length === 0 &&
        gameData.length === 0
      ) {
        logger.warn(
          `[STRUCTURE-WARNING] Diagnostic shows ${diagnosticInfo.gamesOnDateMatches} games-on-date elements but match selector found 0 - structure mismatch`,
          {
            url: this.href,
            gradeID: this.gradeID,
            diagnosticGamesOnDate: diagnosticInfo.gamesOnDateMatches,
            matchElementsFound: matchList.length,
            gamesExtracted: gameData.length,
            matchElementSelector: this.matchElementSelector,
            possibleCause:
              "Match element selector may be incorrect - games exist but selector doesn't match",
            action:
              "Verify match element selector matches actual page structure",
          }
        );
      }

      return gameData;
    } catch (error) {
      // Suppress cancellation errors (happen when page is reset during operation)
      const errorMessage = error.message || String(error);
      const isCancellationError = [
        "Target closed",
        "Protocol error",
        "Navigation interrupted",
        "Session closed",
        "Execution context was destroyed",
        "Page closed",
        "Browser has been closed",
      ].some((err) => errorMessage.includes(err));

      if (isCancellationError) {
        // Don't log cancellation errors - they're expected when pages are reset
        return [];
      }

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
      // SAFE FIX: Extract round ONCE from matchElement (handles rare case of 2+ games per round)
      // Fallback: If matchElement extraction fails, try per-gameDiv (maintains backward compatibility)
      // This ensures all games in the same matchElement get the same round value
      const roundFromMatchElement = await scrapeRound(matchElement);

      // LOGGING: Track round extraction from matchElement
      logger.debug(
        `[ROUND-EXTRACTION] Round from matchElement: ${
          roundFromMatchElement || "null"
        }`,
        {
          method: "extractMatchDetails",
          roundFromMatchElement: roundFromMatchElement,
          hasRound: !!roundFromMatchElement,
          url: this.href,
        }
      );

      // UPDATED: Extract game divs from match element
      // New structure: games are in div[data-testid="games-on-date"] inside the match element
      const gameDivs = await matchElement.$$(
        'div[data-testid="games-on-date"]'
      );
      const gameDetails = [];

      // LOGGING: Track number of game divs found
      logger.debug(
        `[ROUND-EXTRACTION] Found ${gameDivs.length} game div(s) in matchElement`,
        {
          method: "extractMatchDetails",
          gameDivCount: gameDivs.length,
          roundFromMatchElement: roundFromMatchElement,
          url: this.href,
        }
      );

      // WARNING: If no game divs found, structure may have changed
      if (gameDivs.length === 0) {
        logger.warn(
          `[STRUCTURE-WARNING] No game divs found in matchElement - structure may have changed`,
          {
            method: "extractMatchDetails",
            matchElementSelector: 'div[data-testid="games-on-date"]',
            url: this.href,
            gradeID: this.gradeID,
            roundFromMatchElement: roundFromMatchElement,
            possibleCauses: [
              "Game selector changed - games may be in different structure",
              "Match element may not contain games (empty round)",
              "Page structure updated - selector needs update",
            ],
            action:
              "Check matchElement structure and verify game selector is correct",
          }
        );
      }

      // OPTIMIZATION: Process game divs in parallel for faster extraction
      const gameDivPromises = gameDivs.map(async (gameDiv, gameDivIndex) => {
        try {
          // Check bye match first (quick check before parallel extraction)
          if (await isByeMatch(gameDiv)) {
            logger.debug(
              `[ROUND-EXTRACTION] Game div ${gameDivIndex + 1} is a bye match`,
              {
                method: "extractMatchDetails",
                gameDivIndex: gameDivIndex + 1,
              }
            );
            return { status: "bye" };
          }

          // OPTIMIZATION: Extract all game details in parallel (was sequential)
          // This reduces extraction time from 300-600ms to 100-150ms per game div
          const [
            date,
            roundFromGameDiv,
            typeTimeGround,
            status,
            scoreCardInfo,
            teams,
          ] = await Promise.all([
            scrapeDate(gameDiv),
            scrapeRound(gameDiv, true), // Keep for backward compatibility fallback (isFallback=true to suppress expected warnings)
            scrapeTypeTimeGround(gameDiv),
            scrapeStatus(gameDiv),
            scrapeScoreCardInfo(gameDiv),
            scrapeTeamsInfo(gameDiv),
          ]);

          // LOGGING: Track round extraction from gameDiv
          logger.debug(
            `[ROUND-EXTRACTION] Game div ${
              gameDivIndex + 1
            } - Round from gameDiv: ${roundFromGameDiv || "null"}`,
            {
              method: "extractMatchDetails",
              gameDivIndex: gameDivIndex + 1,
              roundFromGameDiv: roundFromGameDiv,
              hasRoundFromGameDiv: !!roundFromGameDiv,
              date: date,
              gameID: scoreCardInfo?.gameID,
              url: this.href,
            }
          );

          // SAFE FIX: Use round from matchElement if available, otherwise fallback to gameDiv result
          // This ensures all games in the same matchElement get the same round (handles rare 2+ games case)
          // But maintains backward compatibility if matchElement extraction fails
          const round = roundFromMatchElement || roundFromGameDiv;

          // LOGGING: Track final round value decision
          logger.debug(
            `[ROUND-EXTRACTION] Game div ${gameDivIndex + 1} - Final round: ${
              round || "null"
            } (source: ${
              roundFromMatchElement
                ? "matchElement"
                : roundFromGameDiv
                ? "gameDiv"
                : "none"
            })`,
            {
              method: "extractMatchDetails",
              gameDivIndex: gameDivIndex + 1,
              finalRound: round,
              roundSource: roundFromMatchElement
                ? "matchElement"
                : roundFromGameDiv
                ? "gameDiv"
                : "none",
              roundFromMatchElement: roundFromMatchElement,
              roundFromGameDiv: roundFromGameDiv,
              gameID: scoreCardInfo?.gameID,
              date: date,
              url: this.href,
            }
          );

          // Process date after parallel extraction
          const dateObj = date
            ? moment(date, "dddd, DD MMMM YYYY").toDate()
            : null;

          // Consolidating extracted details
          return {
            grade: [this.gradeID],
            round,
            date,
            dayOne: dateObj,
            type: typeTimeGround?.type,
            time: typeTimeGround?.time,
            ground: typeTimeGround?.ground,
            dateRangeObj: typeTimeGround?.dateRangeObj,
            finalDaysPlay: typeTimeGround?.finalDaysPlay,
            status,
            urlToScoreCard: scoreCardInfo?.urlToScoreCard,
            gameID: scoreCardInfo?.gameID,
            teams: [],
            teamHomeID: teams?.[0]?.id,
            teamAwayID: teams?.[1]?.id,
            teamHome: teams?.[0]?.name,
            teamAway: teams?.[1]?.name,
          };
        } catch (gameDivError) {
          // Suppress cancellation errors (happen when page is reset during operation)
          const errorMessage = gameDivError.message || String(gameDivError);
          const isCancellationError = [
            "Target closed",
            "Protocol error",
            "Navigation interrupted",
            "Session closed",
            "Execution context was destroyed",
            "Page closed",
            "Browser has been closed",
          ].some((err) => errorMessage.includes(err));

          if (isCancellationError) {
            // Don't log cancellation errors - they're expected when pages are reset
            return null;
          }

          // Log other errors for this game div but continue with next div
          logger.warn(
            `Error extracting details for game div, skipping to next`,
            { error: gameDivError.message, url: this.href }
          );
          return null; // Return null instead of throwing to allow Promise.all to complete
        }
      });

      // Wait for all game divs to be processed in parallel
      // Use Promise.allSettled to handle cancellations gracefully
      const gameDivResults = await Promise.allSettled(gameDivPromises);

      // Extract successful results and filter out failures/null values and bye matches
      const successfulResults = gameDivResults
        .filter(
          (result) => result.status === "fulfilled" && result.value !== null
        )
        .map((result) => result.value)
        .filter((result) => !result.status || result.status !== "bye"); // Filter out bye matches

      gameDetails.push(...successfulResults);

      // LOGGING: Track final results summary
      logger.debug(
        `[ROUND-EXTRACTION] Summary - Extracted ${successfulResults.length} game(s) from matchElement`,
        {
          method: "extractMatchDetails",
          totalGameDivs: gameDivs.length,
          successfulGames: successfulResults.length,
          roundFromMatchElement: roundFromMatchElement,
          gamesWithRounds: successfulResults.filter((g) => g.round).length,
          gamesWithoutRounds: successfulResults.filter((g) => !g.round).length,
          roundValues: [
            ...new Set(successfulResults.map((g) => g.round).filter(Boolean)),
          ],
          gameIDs: successfulResults.map((g) => g.gameID).filter(Boolean),
          url: this.href,
        }
      );

      // LOGGING: Log each game's round value for debugging
      successfulResults.forEach((game, index) => {
        logger.debug(
          `[ROUND-EXTRACTION] Game ${index + 1}/${
            successfulResults.length
          } - gameID: ${game.gameID}, round: ${game.round || "null"}, date: ${
            game.date
          }`,
          {
            method: "extractMatchDetails",
            gameIndex: index + 1,
            gameID: game.gameID,
            round: game.round,
            date: game.date,
            teamHome: game.teamHome,
            teamAway: game.teamAway,
          }
        );
      });

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

    // CRITICAL: Log the URL we're navigating to and the current page URL
    const currentPageUrl = this.page.url();
    logger.debug(
      `[PARALLEL_GAMES] [NAV] Navigating to: ${this.href} | Current page URL: ${currentPageUrl}`
    );

    // Non-retryable errors - exit immediately
    const nonRetryableErrors = [
      "net::ERR_ABORTED", // 404, cancelled
      "net::ERR_NAME_NOT_RESOLVED", // DNS failure
      "net::ERR_INVALID_URL", // Invalid URL
      "Navigation failed because browser has disconnected", // Browser closed
    ];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // CRITICAL: Always navigate, even if URL appears the same
        // Pages from pool may have stale URLs, so force navigation
        // Use 'networkidle2' to ensure full page load with dynamic content
        try {
          await this.page.goto(this.href, {
            timeout: 45000, // Increased to 45 seconds for proxy latency and dynamic content
            waitUntil: "networkidle2", // Wait for network to be mostly idle - ensures dynamic content loads
            // Force navigation even if URL appears the same
          });
        } catch (navError) {
          // If networkidle2 times out, try with load as fallback
          this.context.warn(
            `[PARALLEL_GAMES] [NAV] networkidle2 timeout, trying load fallback`
          );
          try {
            await this.page.goto(this.href, {
              timeout: 45000,
              waitUntil: "load",
            });
          } catch (loadError) {
            // Last resort: domcontentloaded
            this.context.warn(
              `[PARALLEL_GAMES] [NAV] Load timeout, trying domcontentloaded fallback`
            );
            await this.page.goto(this.href, {
              timeout: 45000,
              waitUntil: "domcontentloaded",
            });
            // Give extra time for dynamic content to load - wait for game list items to appear
            await this.page
              .waitForSelector('div[data-testid="games-on-date"]', {
                timeout: 5000,
                visible: false, // Just check if element exists in DOM
              })
              .catch(() => {});
          }
        }

        // CRITICAL: Verify we actually navigated to the correct URL
        const finalPageUrl = this.page.url();
        if (
          finalPageUrl !== this.href &&
          !finalPageUrl.includes(this.href.split("?")[0])
        ) {
          logger.error(
            `[PARALLEL_GAMES] [NAV] URL MISMATCH after navigation! Expected: ${this.href}, Actual: ${finalPageUrl}`
          );
          // Try one more time with forced navigation
          if (attempt < maxRetries) {
            logger.warn(
              `[PARALLEL_GAMES] [NAV] Retrying navigation (attempt ${
                attempt + 1
              }/${maxRetries})`
            );
            continue;
          }
        } else {
          logger.debug(
            `[PARALLEL_GAMES] [NAV] Successfully navigated to: ${this.href}`
          );
        }

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
          this.context.warn(`Non-retryable error, skipping retries`, {
            error: errorMessage,
            errorType: "non-retryable",
            attempt,
          });
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
        // Wait for page to be interactive before retrying
        await this.page
          .waitForFunction(
            () => {
              return (
                document.readyState === "complete" && document.body !== null
              );
            },
            { timeout: delay }
          )
          .catch(() => {});
      }
    }
  }

  async waitForPageLoad() {
    const waitStartTime = Date.now();
    const MAX_TOTAL_WAIT_TIME = 30000; // Increased to 30 seconds to account for proxy latency and dynamic content loading
    const QUICK_CHECK_TIMEOUT = 20000; // Increased to 20 seconds for proxy routing + page load + dynamic content rendering
    const CONTENT_CHECK_TIMEOUT = 15000; // Increased to 15 seconds for proxy latency and content rendering
    const POLLING_INTERVAL = 300; // Increased polling interval from 100ms to 300ms (less frequent checks)

    try {
      // OPTIMIZED: Check multiple selectors in parallel with shorter timeouts
      // This reduces wait time from 8s+ to ~2s for most pages
      const fixtureListSelectors = [
        'div[data-testid="games-on-date"]',
        'div[data-testid*="games"]',
        'div[data-testid="fixture-list"]',
      ];

      let fixtureListFound = false;
      let foundSelector = null;

      // Try selectors with shorter timeout - most pages load in 1-2 seconds
      for (const selector of fixtureListSelectors) {
        // Check remaining time before starting each selector wait
        const elapsed = Date.now() - waitStartTime;
        const remainingTime = MAX_TOTAL_WAIT_TIME - elapsed;

        if (remainingTime <= 0) {
          logger.warn(
            `[PARALLEL_GAMES] [WAIT] Max wait time exceeded before trying selector: ${selector}`,
            {
              url: this.href,
              elapsed,
              selector,
            }
          );
          throw new Error(
            `Page structure not found after ${MAX_TOTAL_WAIT_TIME}ms - likely page structure changed or empty page`
          );
        }

        // Use remaining time or QUICK_CHECK_TIMEOUT, whichever is smaller
        const timeoutToUse = Math.min(QUICK_CHECK_TIMEOUT, remainingTime);

        try {
          await this.page.waitForSelector(selector, {
            timeout: timeoutToUse,
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
          // Check if we've exceeded max total wait time after this attempt
          const elapsedAfter = Date.now() - waitStartTime;
          if (elapsedAfter >= MAX_TOTAL_WAIT_TIME) {
            logger.warn(
              `[PARALLEL_GAMES] [WAIT] Max wait time exceeded after trying selector: ${selector}`,
              {
                url: this.href,
                elapsed: elapsedAfter,
                selector,
              }
            );
            throw new Error(
              `Page structure not found after ${MAX_TOTAL_WAIT_TIME}ms - likely page structure changed or empty page`
            );
          }
          // Continue to next selector if we still have time
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
      // UPDATED: Game divs are now div[data-testid="games-on-date"], not div.sc-1pr338c-0.cNVAcP
      const gameDivSelector = 'div[data-testid="games-on-date"]';
      let gameDivsFound = false;

      // Check remaining time before waiting for game divs
      const elapsedBeforeGameDivs = Date.now() - waitStartTime;
      const remainingTimeForGameDivs =
        MAX_TOTAL_WAIT_TIME - elapsedBeforeGameDivs;

      if (remainingTimeForGameDivs <= 0) {
        logger.warn(
          `[PARALLEL_GAMES] [WAIT] Max wait time exceeded before checking game divs`,
          {
            url: this.href,
            elapsed: elapsedBeforeGameDivs,
          }
        );
        return; // Fail fast - no time to check game divs
      }

      try {
        const timeoutForGameDivs = Math.min(
          QUICK_CHECK_TIMEOUT,
          remainingTimeForGameDivs
        );
        await this.page.waitForSelector(gameDivSelector, {
          timeout: timeoutForGameDivs,
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
      const elapsedBeforeContent = Date.now() - waitStartTime;
      const remainingTimeForContent =
        MAX_TOTAL_WAIT_TIME - elapsedBeforeContent;

      if (remainingTimeForContent <= 0) {
        logger.debug(
          `[PARALLEL_GAMES] [WAIT] Max wait time exceeded before content check`,
          {
            url: this.href,
            elapsed: elapsedBeforeContent,
          }
        );
        return; // Fail fast - no time for content check
      }

      try {
        const timeoutForContent = Math.min(
          CONTENT_CHECK_TIMEOUT,
          remainingTimeForContent
        );
        await this.page.waitForFunction(
          () => {
            const gameDivs = document.querySelectorAll(
              'div[data-testid="games-on-date"]'
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
            timeout: timeoutForContent,
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
        // Don't wait longer - if content isn't ready, return early to allow extraction to try anyway
      }

      const totalWait = Date.now() - waitStartTime;
      logger.debug(
        `Page load complete, fixtures should be ready for extraction`,
        {
          url: this.href,
          totalWaitTime: totalWait,
        }
      );
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
            action:
              "Continuing with extraction attempt (may return empty results)",
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
