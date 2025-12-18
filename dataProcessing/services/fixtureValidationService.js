const logger = require("../../src/utils/logger");
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");
const {
  processInParallel,
} = require("../../dataProcessing/utils/parallelUtils");
const { PARALLEL_CONFIG } = require("../../dataProcessing/puppeteer/constants");

/**
 * FixtureValidationService handles URL validation for fixtures.
 * Uses Puppeteer to validate JavaScript-rendered pages and detect 404s.
 * OPTIMIZED: Uses same pattern as other scrapers (domcontentloaded + waitForSelector)
 */
class FixtureValidationService {
  constructor(options = {}) {
    this.domain = "https://www.playhq.com";
    // PERFORMANCE OPTIMIZATION: Increased timeout to account for proxy latency
    // Proxy adds significant load time, so we need longer timeouts to avoid false failures
    this.timeout = options.timeout || 8000; // Increased from 1000ms to 8000ms for proxy
    this.skipHttpValidation = options.skipHttpValidation !== false; // Default: true (PlayHQ blocks HTTP)
    this.usePuppeteer = options.usePuppeteer !== false; // Default: true
    this.puppeteerManager = null;
    this.browser = null;
  }

  async initializeBrowser() {
    if (!this.usePuppeteer || this.puppeteerManager) return;
    // Use singleton to share browser instance across services (memory optimization)
    this.puppeteerManager = PuppeteerManager.getInstance();
    await this.puppeteerManager.launchBrowser();
    this.browser = this.puppeteerManager.browser;
  }

  async cleanupBrowser() {
    // Browser cleanup handled by PuppeteerManager
  }

  /**
   * Validates a single fixture URL using Puppeteer
   * OPTIMIZED: Uses domcontentloaded (like other scrapers) + quick content check
   */
  async validateFixtureUrlWithPuppeteer(
    urlToScoreCard,
    fixtureId,
    gameID,
    page
  ) {
    if (!urlToScoreCard) {
      return {
        valid: false,
        status: "no_url",
        fixtureId,
        gameID,
        url: null,
      };
    }

    const fullUrl = urlToScoreCard.startsWith("http")
      ? urlToScoreCard
      : `${this.domain}${urlToScoreCard}`;

    try {
      if (!page) {
        throw new Error("Page instance is required for Puppeteer validation");
      }

      // FIX: Use 'load' instead of 'domcontentloaded' to wait for JavaScript rendering
      // The 404 message "Oops, not another 404!" is rendered by JavaScript after DOM loads
      // 'load' waits for the load event which fires after JavaScript executes
      let response;
      try {
        // Try 'load' first (waits for load event - ensures JavaScript has executed)
        response = await page.goto(fullUrl, {
          waitUntil: "load", // Wait for load event - ensures JavaScript has rendered
          timeout: this.timeout, // 8 seconds
        });
      } catch (loadError) {
        // If 'load' times out, try 'domcontentloaded' as fallback
        logger.debug(
          `[VALIDATION] Load timeout for: ${fullUrl}, trying domcontentloaded fallback`,
          {
            error: loadError.message,
            fixtureId,
            gameID,
          }
        );
        try {
          response = await page.goto(fullUrl, {
            waitUntil: "domcontentloaded", // Fallback - DOM ready but JS might not be done
            timeout: this.timeout,
          });
          // Give extra time for JavaScript to render 404 message
          await page.waitForTimeout(2000).catch(() => {}); // Wait 2 seconds for JS to render
        } catch (navError) {
          // Navigation errors usually mean 404
          if (navError.message && navError.message.includes("net::ERR_")) {
            logger.debug(`[VALIDATION] Navigation failed for: ${fullUrl}`, {
              error: navError.message,
              fixtureId,
              gameID,
            });
            return {
              valid: false,
              status: "404",
              fixtureId,
              gameID,
              url: fullUrl,
              httpStatus: "navigation_failed",
              method: "puppeteer",
            };
          }
          // For timeout, page might still be loading - check content anyway
          if (navError.message.includes("timeout")) {
            logger.debug(
              `[VALIDATION] Navigation timeout for: ${fullUrl}, checking content anyway`,
              {
                error: navError.message,
                fixtureId,
                gameID,
              }
            );
            // Continue to check content
          } else {
            throw navError;
          }
        }
      }

      // PERFORMANCE OPTIMIZATION: Reduced waits while accounting for proxy latency
      // Proxy adds significant load time, so we use longer timeouts but fewer waits
      try {
        // Check if page is still connected
        if (page.isClosed()) {
          throw new Error("Page is closed");
        }

        // PERFORMANCE OPTIMIZATION: Wait for body with increased timeout for proxy
        // Increased timeout from 5000ms to 10000ms to account for proxy latency
        await page.waitForSelector("body", {
          timeout: 10000, // Increased for proxy latency
          visible: true,
        });

        // PERFORMANCE OPTIMIZATION: Reduced waitForFunction timeout but increased base timeout
        // Check for content with shorter wait (content check is less critical than initial load)
        try {
          await page.waitForFunction(
            () => {
              if (!document.body) return false;

              const bodyText = document.body.innerText || "";
              const bodyHtml = document.body.innerHTML || "";

              // Check for explicit PlayHQ 404 indicators (the actual message "Oops, not another 404!")
              const h1Elements = Array.from(document.querySelectorAll("h1"));
              const hasPlayHQ404 = h1Elements.some(
                (h1) =>
                  h1.innerText &&
                  h1.innerText.toLowerCase().includes("oops, not another 404")
              );
              const has404Text =
                bodyText.includes("oops, not another 404") ||
                bodyText.includes("sorry you have arrived here");
              const has404 = hasPlayHQ404 || has404Text;

              // Check for valid game content indicators
              const hasGameContent =
                bodyText.length > 100 || // Substantial content
                bodyHtml.includes("scorecard") ||
                bodyHtml.includes("game") ||
                bodyHtml.includes("fixture") ||
                document.querySelector('[data-testid*="score"]') ||
                document.querySelector('[data-testid*="game"]');

              // Page is ready if it has either 404 content OR game content
              return has404 || hasGameContent;
            },
            {
              timeout: 15000, // Increased to 15 seconds to wait for JavaScript rendering of 404 message
              polling: 500, // Check every 500ms for 404 message to appear
            }
          );
          logger.debug(`[VALIDATION] Page content loaded for ${fullUrl}`);
        } catch (waitFuncError) {
          // If waitForFunction times out, continue anyway and check content
          // This ensures we still check even if the wait times out
          logger.debug(
            `[VALIDATION] Content check timeout for ${fullUrl}, checking content anyway`,
            { error: waitFuncError.message }
          );
          // Give a small delay to let JavaScript finish rendering the 404 message
          await page.waitForTimeout(2000).catch(() => {}); // Wait 2 seconds for JS to render
          // Continue to content check - don't fail on timeout
        }
      } catch (waitError) {
        // If body doesn't load or page is closed, return error result
        if (
          waitError.message.includes("closed") ||
          waitError.message.includes("Target closed")
        ) {
          throw new Error(`Page closed during wait: ${waitError.message}`);
        }
        // PERFORMANCE OPTIMIZATION: If timeout, continue to check content anyway
        // Proxy latency may cause timeouts, so we don't fail immediately
        logger.debug(
          `[VALIDATION] Wait error for ${fullUrl}, checking content anyway: ${waitError.message}`
        );
        // Continue to content check
      }

      // Check if page is still connected before evaluation
      if (page.isClosed()) {
        throw new Error("Page closed before evaluation");
      }

      const httpStatus = response ? response.status() : "unknown";
      let finalUrl;
      try {
        finalUrl = page.url();
      } catch (urlError) {
        logger.debug(
          `[VALIDATION] Could not get page URL: ${urlError.message}`
        );
        finalUrl = fullUrl;
      }

      // Check page content for 404 indicators and game content
      let pageInfo = {};
      try {
        // Check if page is still connected before evaluate
        if (page.isClosed()) {
          throw new Error("Page closed before evaluate");
        }
        pageInfo = await page.evaluate(() => {
          const bodyText = document.body
            ? document.body.innerText.toLowerCase()
            : "";
          const htmlContent = document.body
            ? document.body.innerHTML.toLowerCase()
            : "";

          // PlayHQ 404 page structure (EXPLICIT indicators only):
          // <h1>Oops, not another 404!</h1>
          // <p>Sorry you have arrived here...</p>
          const h1Elements = Array.from(document.querySelectorAll("h1"));
          const hasPlayHQ404H1 = h1Elements.some(
            (h1) =>
              h1.innerText &&
              h1.innerText.toLowerCase().includes("oops, not another 404")
          );

          // Check for PlayHQ 404 text (EXPLICIT only - don't use generic "404" or "not found")
          const hasPlayHQ404Text =
            bodyText.includes("sorry you have arrived here") ||
            bodyText.includes("oops, not another 404");

          // ONLY use explicit PlayHQ 404 indicators - don't use generic "404" or "not found"
          // as these can appear in valid pages (URLs, error codes in content, etc.)
          const hasExplicit404 = hasPlayHQ404H1 || hasPlayHQ404Text;

          // Check for game page elements (more specific than generic patterns)
          // Look for actual game page structure elements
          const hasScorecardSection =
            document.querySelector('[class*="scorecard"]') !== null ||
            document.querySelector('[class*="score-card"]') !== null ||
            document.querySelector('[id*="scorecard"]') !== null;

          const hasTeamElements =
            document.querySelector('[class*="team"]') !== null ||
            document.querySelector('[class*="home-team"]') !== null ||
            document.querySelector('[class*="away-team"]') !== null;

          const hasGameDetails =
            document.querySelector('[class*="game-detail"]') !== null ||
            document.querySelector('[class*="match-detail"]') !== null ||
            document.querySelector('[class*="fixture"]') !== null;

          // Check for game content in text (teams, scores, dates, etc.)
          const hasTeamVs = bodyText.match(/\b(vs|versus|v\.)\b/i) !== null;
          const hasScorePattern = bodyText.match(/\d+\s*-\s*\d+/) !== null;
          const hasGameTerms =
            bodyText.includes("scorecard") ||
            bodyText.includes("score") ||
            bodyText.includes("round") ||
            bodyText.includes("ground") ||
            bodyText.includes("inning") ||
            bodyText.includes("over") ||
            bodyText.includes("wicket") ||
            bodyText.includes("batting") ||
            bodyText.includes("bowling");

          // Check for substantial content (404 pages are usually minimal - < 500 chars)
          const hasSubstantialContent = bodyText.length > 500;

          // Check for date patterns (games have dates)
          const hasDatePattern =
            /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+\w+\s+\d{4}|\w+day,?\s+\d{1,2}\s+\w+)\b/i.test(
              bodyText
            );

          // Game content exists if we have page elements OR text patterns OR substantial content
          const hasGameContent =
            hasScorecardSection ||
            hasTeamElements ||
            hasGameDetails ||
            hasTeamVs ||
            hasScorePattern ||
            hasGameTerms ||
            hasDatePattern ||
            (hasSubstantialContent && bodyText.length > 800);

          return {
            hasExplicit404,
            hasPlayHQ404H1,
            hasPlayHQ404Text,
            hasGameContent,
            bodyLength: bodyText.length,
            hasSubstantialContent,
            hasScorecardSection,
            hasTeamElements,
            hasGameDetails,
          };
        });
      } catch (contentError) {
        // If we can't check content, log and return error result
        const errorMsg = contentError.message || String(contentError);
        logger.error(
          `[VALIDATION] Could not evaluate page content for ${fullUrl}: ${errorMsg}`,
          {
            fixtureId,
            gameID,
            error: errorMsg,
            stack: contentError.stack,
          }
        );

        // If page is closed or disconnected, throw to be caught by outer catch
        if (
          errorMsg.includes("closed") ||
          errorMsg.includes("Target closed") ||
          errorMsg.includes("Session closed") ||
          errorMsg.includes("Protocol error")
        ) {
          throw new Error(`Page disconnected during evaluation: ${errorMsg}`);
        }

        // For other errors, return error result
        return {
          valid: false,
          status: "error",
          fixtureId,
          gameID,
          url: fullUrl,
          error: errorMsg,
        };
      }

      // FIX: Add detailed logging to debug 404 detection issues
      logger.debug(`[VALIDATION] Page info for ${fullUrl}:`, {
        hasExplicit404: pageInfo.hasExplicit404,
        hasPlayHQ404H1: pageInfo.hasPlayHQ404H1,
        hasPlayHQ404Text: pageInfo.hasPlayHQ404Text,
        hasGameContent: pageInfo.hasGameContent,
        bodyLength: pageInfo.bodyLength,
        httpStatus,
        fixtureId,
        gameID,
      });

      // PRIORITY 1: Check for EXPLICIT PlayHQ 404 indicators ONLY
      // Only mark as 404 if we see the specific PlayHQ 404 page structure
      if (pageInfo.hasExplicit404 || httpStatus === 404) {
        logger.info(`[VALIDATION] 404 detected (explicit): ${fullUrl}`, {
          hasPlayHQ404H1: pageInfo.hasPlayHQ404H1,
          hasPlayHQ404Text: pageInfo.hasPlayHQ404Text,
          httpStatus,
          fixtureId,
          gameID,
        });
        return {
          valid: false,
          status: "404",
          fixtureId,
          gameID,
          url: fullUrl,
          httpStatus,
          method: "puppeteer",
        };
      }

      // FIX: If HTTP 200 but we haven't detected 404 yet, do a final check
      // Sometimes the 404 message appears after initial page load
      // Wait a bit longer and check again specifically for the 404 message
      if (httpStatus === 200 && !pageInfo.hasExplicit404) {
        logger.debug(
          `[VALIDATION] HTTP 200 but no explicit 404 detected, doing final 404 check for ${fullUrl}`
        );
        try {
          // Try to wait for h1 element to appear (404 page has h1 with "Oops, not another 404!")
          try {
            await page.waitForSelector("h1", {
              timeout: 3000, // Wait up to 3 seconds for h1
              visible: true,
            });
            // Check if it's the 404 h1
            const h1Text = await page.evaluate(() => {
              const h1 = document.querySelector("h1");
              return h1 ? h1.innerText.toLowerCase() : "";
            });
            if (h1Text.includes("oops, not another 404")) {
              logger.info(
                `[VALIDATION] 404 detected via h1 wait: ${fullUrl}`,
                {
                  h1Text: h1Text.substring(0, 100),
                  httpStatus,
                  fixtureId,
                  gameID,
                }
              );
              return {
                valid: false,
                status: "404",
                fixtureId,
                gameID,
                url: fullUrl,
                httpStatus,
                method: "puppeteer",
              };
            }
          } catch (h1WaitError) {
            // h1 might not exist or might not be 404 - continue to final check
            logger.debug(
              `[VALIDATION] h1 wait completed for ${fullUrl}, proceeding to final check`
            );
          }

          // Wait a bit more for JavaScript to fully render
          await page.waitForTimeout(2000).catch(() => {});

          // Check one more time specifically for the 404 message
          const finalCheck = await page.evaluate(() => {
            const bodyText = document.body
              ? document.body.innerText.toLowerCase()
              : "";
            const h1Elements = Array.from(document.querySelectorAll("h1"));
            const hasPlayHQ404H1 = h1Elements.some(
              (h1) =>
                h1.innerText &&
                h1.innerText.toLowerCase().includes("oops, not another 404")
            );
            const has404Text =
              bodyText.includes("oops, not another 404") ||
              bodyText.includes("sorry you have arrived here");

            return {
              hasPlayHQ404H1,
              has404Text,
              hasExplicit404: hasPlayHQ404H1 || has404Text,
              bodyText: bodyText.substring(0, 200), // First 200 chars for debugging
            };
          });

          logger.debug(`[VALIDATION] Final 404 check for ${fullUrl}:`, {
            hasExplicit404: finalCheck.hasExplicit404,
            hasPlayHQ404H1: finalCheck.hasPlayHQ404H1,
            has404Text: finalCheck.has404Text,
            bodyTextPreview: finalCheck.bodyText,
          });

          if (finalCheck.hasExplicit404) {
            logger.info(
              `[VALIDATION] 404 detected in final check: ${fullUrl}`,
              {
                hasPlayHQ404H1: finalCheck.hasPlayHQ404H1,
                has404Text: finalCheck.has404Text,
                httpStatus,
                fixtureId,
                gameID,
              }
            );
            return {
              valid: false,
              status: "404",
              fixtureId,
              gameID,
              url: fullUrl,
              httpStatus,
              method: "puppeteer",
            };
          }
        } catch (finalCheckError) {
          logger.debug(
            `[VALIDATION] Final 404 check error for ${fullUrl}: ${finalCheckError.message}`
          );
          // Continue with normal validation flow
        }
      }

      // PRIORITY 2: For game center URLs, check if page has minimal content
      // (PlayHQ 404 pages are usually < 500 chars, valid game pages are much larger)
      const isGameCenterUrl =
        finalUrl.includes("/game-centre/") ||
        finalUrl.includes("/game-center/");

      if (isGameCenterUrl) {
        // If page has very little content (< 300 chars), likely a 404 or error page
        if (pageInfo.bodyLength < 300 && !pageInfo.hasGameContent) {
          logger.info(
            `[VALIDATION] 404: ${fullUrl} (game center URL but minimal content: ${pageInfo.bodyLength} chars)`
          );
          return {
            valid: false,
            status: "404",
            fixtureId,
            gameID,
            url: fullUrl,
            httpStatus,
            method: "puppeteer",
          };
        }

        // If we have game content OR substantial content, it's valid
        if (pageInfo.hasGameContent || pageInfo.bodyLength > 500) {
          return {
            valid: true,
            status: httpStatus === 403 ? "valid_403" : "valid",
            fixtureId,
            gameID,
            url: fullUrl,
            httpStatus,
            method: "puppeteer",
          };
        }
      }

      // PRIORITY 3: For non-game-center URLs or if we have substantial content, assume valid
      // (Be lenient - if we don't see explicit 404 indicators, assume page is valid)
      if (pageInfo.hasSubstantialContent || pageInfo.bodyLength > 500) {
        return {
          valid: true,
          status: httpStatus === 403 ? "valid_403" : "valid",
          fixtureId,
          gameID,
          url: fullUrl,
          httpStatus,
          method: "puppeteer",
        };
      }

      // PRIORITY 4: If page loaded successfully (200/403) and has content, assume valid
      // (Don't be too strict - if page loads and has some content, it's probably valid)
      if (
        (httpStatus === 200 || httpStatus === 403) &&
        pageInfo.bodyLength > 200
      ) {
        return {
          valid: true,
          status: httpStatus === 403 ? "valid_403" : "valid",
          fixtureId,
          gameID,
          url: fullUrl,
          httpStatus,
          method: "puppeteer",
        };
      }

      // DEFAULT: Only mark as invalid if we have very strong indicators
      // (Very minimal content AND no game content AND not a successful HTTP status)
      if (
        pageInfo.bodyLength < 200 &&
        httpStatus !== 200 &&
        httpStatus !== 403
      ) {
        logger.info(
          `[VALIDATION] 404: ${fullUrl} (minimal content: ${pageInfo.bodyLength} chars, HTTP: ${httpStatus})`
        );
        return {
          valid: false,
          status: "404",
          fixtureId,
          gameID,
          url: fullUrl,
          httpStatus,
          method: "puppeteer",
        };
      }

      // If we get here, assume valid (be lenient)
      return {
        valid: true,
        status: httpStatus === 403 ? "valid_403" : "valid",
        fixtureId,
        gameID,
        url: fullUrl,
        httpStatus,
        method: "puppeteer",
      };
    } catch (error) {
      logger.error(`[VALIDATION] Error: ${fullUrl} - ${error.message}`);
      return {
        valid: false,
        status: "error",
        fixtureId,
        gameID,
        url: fullUrl,
        error: error.message,
      };
    }
  }

  /**
   * Validates multiple fixture URLs in batches
   * MEMORY OPTIMIZED: Process in small batches with browser cleanup between batches
   */
  async validateFixturesBatch(fixtures, concurrencyLimit = 5) {
    // MEMORY TRACKING: Define memory stats function FIRST before using it
    const getMemoryStats = () => {
      const memUsage = process.memoryUsage();
      return {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      };
    };

    // MEMORY TRACKING: Log initial state
    const batchInitialMemory = getMemoryStats();
    logger.info("[VALIDATION-BATCH] Starting batch validation", {
      fixturesCount: fixtures.length,
      concurrencyLimit,
      initialMemory: {
        rss: `${batchInitialMemory.rss}MB`,
        heapUsed: `${batchInitialMemory.heapUsed}MB`,
      },
    });

    const results = [];

    // TESTING: Log initial memory state
    const initialMemory = getMemoryStats();
    logger.info(
      `[VALIDATION-TEST] Starting validation: ${fixtures.length} fixtures, Initial memory: RSS=${initialMemory.rss}MB, Heap=${initialMemory.heapUsed}MB`
    );

    if (!this.usePuppeteer || this.skipHttpValidation) {
      // MEMORY OPTIMIZATION: Process in small batches (5 fixtures) with browser cleanup
      const batchSize = concurrencyLimit;
      const batches = [];
      for (let i = 0; i < fixtures.length; i += batchSize) {
        batches.push(fixtures.slice(i, i + batchSize));
      }

      logger.info(
        `[VALIDATION] Validating ${fixtures.length} fixtures in ${batches.length} batches (${batchSize} per batch)`
      );

      // Process each batch separately with browser cleanup between batches
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        try {
          // Initialize browser for this batch
          await this.initializeBrowser();
          if (!this.puppeteerManager) {
            throw new Error("PuppeteerManager not initialized");
          }

          logger.info(
            `[VALIDATION] Processing batch ${batchIndex + 1}/${
              batches.length
            } (${batch.length} fixtures)`
          );

          // CRITICAL: Create page pool BEFORE parallel processing starts
          // This ensures all pages are ready and we get true parallel processing
          if (this.puppeteerManager.pagePool.length === 0) {
            logger.info(
              `[VALIDATION] Creating page pool of size ${this.concurrencyLimit} before parallel processing`
            );
            await this.puppeteerManager.createPagePool(this.concurrencyLimit);
          }

          // Process fixtures in this batch in parallel using page pool (Strategy 1: Parallel Page Processing)
          const concurrency = PARALLEL_CONFIG.VALIDATION_CONCURRENCY;

          // MEMORY FIX: Use streaming mode to process results immediately, preventing double accumulation
          // This prevents batchResults.results from accumulating before being pushed to main results array
          const batchResults = await processInParallel(
            batch,
            async (fixture, i) => {
              const taskStartTime = Date.now();
              // Get a page from the pool for this fixture
              const page = await this.puppeteerManager.getPageFromPool();
              const pageAcquiredTime = Date.now();

              try {
                const globalIndex = batchIndex * batchSize + i;
                const fixtureUrl =
                  fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard;
                const fixtureId = fixture.id || fixture.attributes?.id;
                const fixtureGameID =
                  fixture.gameID || fixture.attributes?.gameID;
                const fullUrl = fixtureUrl?.startsWith("http")
                  ? fixtureUrl
                  : `${this.domain}${fixtureUrl}`;

                logger.info(
                  `[PARALLEL_VALIDATION] [TASK-${
                    globalIndex + 1
                  }] START fixture: ${fullUrl} (page acquired: ${
                    pageAcquiredTime - taskStartTime
                  }ms)`
                );

                // Set user agent on page
                try {
                  await page.setUserAgent(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                  );
                } catch (uaError) {
                  // Ignore
                }

                // Check if page is still valid before validation
                if (!page || page.isClosed()) {
                  throw new Error(
                    "Page is closed or invalid - cannot validate"
                  );
                }

                const validateStartTime = Date.now();
                const result = await this.validateFixtureUrlWithPuppeteer(
                  fixtureUrl,
                  fixtureId,
                  fixtureGameID,
                  page
                );
                result.method = "puppeteer";
                const validateDuration = Date.now() - validateStartTime;
                const taskDuration = Date.now() - taskStartTime;

                // Log detailed result for every iteration: URL, Response, Verdict
                logger.info(
                  `[VALIDATION] Iteration ${globalIndex + 1}/${
                    fixtures.length
                  } - RESULT`,
                  {
                    url: fullUrl,
                    fixtureId,
                    gameID: fixtureGameID,
                    httpStatus: result.httpStatus || "N/A",
                    responseStatus: result.status,
                    valid: result.valid,
                    verdict: result.valid ? "VALID" : "INVALID",
                    method: result.method,
                    error: result.error || null,
                  }
                );

                // Also log a concise one-liner for easy reading
                const verdict = result.valid ? "✓ VALID" : "✗ INVALID";
                logger.info(
                  `[VALIDATION] ${globalIndex + 1}/${
                    fixtures.length
                  } - ${verdict} | URL: ${fullUrl} | HTTP: ${
                    result.httpStatus || "N/A"
                  } | Status: ${result.status}`
                );

                logger.info(
                  `[PARALLEL_VALIDATION] [TASK-${
                    globalIndex + 1
                  }] COMPLETE fixture: ${fullUrl} (validation: ${validateDuration}ms, total: ${taskDuration}ms, verdict: ${verdict})`
                );

                // MEMORY FIX: Return only minimal result data, don't store full URLs or error messages
                // Extract only essential fields needed for comparison/cleanup
                return {
                  fixtureId: result.fixtureId,
                  gameID: result.gameID,
                  valid: result.valid,
                  status: result.status, // String status: "404", "valid", "error", "no_url", etc.
                  httpStatus: result.httpStatus, // HTTP status code number (200, 404, 403, etc.) - used for logging
                  // Don't include: url (can be reconstructed), error (only needed for logging), method
                };
              } catch (error) {
                // Log error with full details
                const errorMsg = error.message || String(error);
                const fixtureUrl =
                  fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard;
                const fixtureId = fixture.id || fixture.attributes?.id;
                const fixtureGameID =
                  fixture.gameID || fixture.attributes?.gameID;
                const globalIndex = batchIndex * batchSize + i;
                const fullUrl = fixtureUrl?.startsWith("http")
                  ? fixtureUrl
                  : `${this.domain}${fixtureUrl}`;

                logger.error(
                  `[VALIDATION] Iteration ${globalIndex + 1}/${
                    fixtures.length
                  } - ERROR`,
                  {
                    url: fullUrl,
                    fixtureId,
                    gameID: fixtureGameID,
                    error: errorMsg,
                    stack: error.stack,
                  }
                );

                // MEMORY FIX: Return minimal error result, don't store full URL or error message
                const errorResult = {
                  valid: false,
                  status: "error",
                  fixtureId,
                  gameID: fixtureGameID,
                  httpStatus: null, // No HTTP status for errors
                  // Don't include: url, error (only needed for logging)
                };

                // Log error result
                logger.info(
                  `[VALIDATION] ${globalIndex + 1}/${
                    fixtures.length
                  } - ✗ ERROR | URL: ${fullUrl} | Error: ${errorMsg}`
                );

                // MEMORY FIX: Return minimal error result instead of throwing
                // This prevents full error objects from being stored in results array
                return errorResult;
              } finally {
                // Release page back to pool after processing
                await this.puppeteerManager
                  .releasePageFromPool(page)
                  .catch(() => {
                    // Ignore errors - page might already be closed
                  });
              }
            },
            concurrency,
            {
              context: "fixture_validation",
              logProgress: false, // We have our own detailed logging
              continueOnError: true,
              // MEMORY FIX: Enable streaming mode to process results immediately
              streamResults: true,
              onResult: async (minimalResult, index, fixture) => {
                // Process result immediately, don't accumulate in batchResults.results
                // The result is already minimal (fixtureId, gameID, valid, status, httpStatus)
                try {
                  // TESTING: Check for duplicates before adding
                  const isDuplicate = results.some(
                    (r) =>
                      r.fixtureId === minimalResult.fixtureId &&
                      r.gameID === minimalResult.gameID
                  );

                  if (isDuplicate) {
                    logger.warn(
                      `[VALIDATION-TEST] Duplicate result detected: fixtureId=${minimalResult.fixtureId}, gameID=${minimalResult.gameID}`
                    );
                  } else {
                    results.push(minimalResult);

                    // TESTING: Log every 10 results for monitoring
                    if (results.length % 10 === 0) {
                      const currentMemory = getMemoryStats();
                      logger.info(
                        `[VALIDATION-TEST] Results collected: ${
                          results.length
                        }/${fixtures.length}, Memory: RSS=${
                          currentMemory.rss
                        }MB (+${
                          currentMemory.rss - initialMemory.rss
                        }MB), Heap=${currentMemory.heapUsed}MB (+${
                          currentMemory.heapUsed - initialMemory.heapUsed
                        }MB)`
                      );
                    }
                  }
                } catch (callbackError) {
                  // Log callback errors but don't throw - allow processing to continue
                  logger.error(
                    `[VALIDATION] Error in onResult callback for fixture ${
                      index + 1
                    }`,
                    {
                      error: callbackError.message,
                      fixtureId: minimalResult?.fixtureId,
                      gameID: minimalResult?.gameID,
                    }
                  );
                }
              },
            }
          );

          // MEMORY FIX: With streaming enabled, batchResults.results will be empty
          // Results are already pushed to main results array via onResult callback
          // No need to extract and push minimalResults here

          // TESTING: Verify batch results are empty (streaming working correctly)
          if (batchResults.results && batchResults.results.length > 0) {
            logger.warn(
              `[VALIDATION-TEST] WARNING: batchResults.results is not empty (${batchResults.results.length} items) - streaming may not be working correctly`
            );
          } else {
            logger.debug(
              `[VALIDATION-TEST] Batch ${
                batchIndex + 1
              }: Streaming working correctly - batchResults.results is empty`
            );
          }

          // Log batch summary before clearing
          if (batchResults.errors && batchResults.errors.length > 0) {
            logger.warn(
              `[VALIDATION] Batch ${batchIndex + 1} completed with ${
                batchResults.errors.length
              } errors`
            );
          }

          // TESTING: Log memory after each batch
          const batchMemory = getMemoryStats();
          logger.info(
            `[VALIDATION-BATCH] Batch ${batchIndex + 1}/${
              batches.length
            } complete`,
            {
              results: {
                count: results.length,
                total: fixtures.length,
                percentage: `${Math.round(
                  (results.length / fixtures.length) * 100
                )}%`,
              },
              memory: {
                rss: `${batchMemory.rss}MB (+${
                  batchMemory.rss - initialMemory.rss
                }MB)`,
                heapUsed: `${batchMemory.heapUsed}MB (+${
                  batchMemory.heapUsed - initialMemory.heapUsed
                }MB)`,
                heapTotal: `${batchMemory.heapTotal}MB`,
              },
              pagePool: {
                size: this.puppeteerManager?.pagePool?.length || 0,
                activePages: this.puppeteerManager?.activePages?.size || 0,
              },
            }
          );

          // PERFORMANCE OPTIMIZATION: Clear batch results immediately
          batchResults.results = null;
          batchResults.errors = null;

          // PERFORMANCE OPTIMIZATION: Reduced DOM clearing frequency
          // Clear DOM only every 5 batches instead of every batch to reduce overhead
          // Proxy latency makes DOM clearing expensive, so we do it less frequently
          if (batchIndex > 0 && batchIndex % 5 === 0 && this.puppeteerManager && this.puppeteerManager.pagePool) {
            try {
              const pagesToClear = [...this.puppeteerManager.pagePool];
              const clearPromises = pagesToClear.map(async (page) => {
                if (page && !page.isClosed()) {
                  try {
                    // Navigate to blank page to clear DOM content
                    await page.goto("about:blank", {
                      waitUntil: "domcontentloaded",
                      timeout: 2000,
                    });
                  } catch (clearError) {
                    // Ignore errors - page might be in use or closed
                    logger.debug(
                      `[VALIDATION] Could not clear page DOM: ${clearError.message}`
                    );
                  }
                }
              });
              await Promise.allSettled(clearPromises);
              logger.debug(
                `[VALIDATION] Cleared DOM for ${
                  pagesToClear.length
                } pages after batch ${batchIndex + 1}`
              );
            } catch (clearError) {
              logger.warn(
                `[VALIDATION] Error clearing page DOM: ${clearError.message}`
              );
            }
          }

          // PERFORMANCE OPTIMIZATION: Reduced GC frequency
          // GC hint every 5 batches instead of every 3 to reduce overhead
          if (batchIndex > 0 && batchIndex % 5 === 0 && global.gc) {
            global.gc();
            logger.info(
              `[VALIDATION] GC hint after batch ${batchIndex + 1}/${
                batches.length
              }`
            );
          }

          // Cleanup orphaned pages
          if (this.puppeteerManager) {
            await this.puppeteerManager.cleanupOrphanedPages();
          }
        } catch (batchError) {
          const errorMsg = batchError.message || String(batchError);
          logger.error(
            `[VALIDATION] Batch ${batchIndex + 1}/${
              batches.length
            } error: ${errorMsg}`,
            {
              error: errorMsg,
              stack: batchError.stack,
              batchSize: batch.length,
              batchIndex: batchIndex + 1,
              totalBatches: batches.length,
            }
          );

          // Add error results for all fixtures in this batch that weren't processed yet
          // Calculate how many fixtures in this batch were already processed
          const fixturesProcessedBeforeBatch = batchIndex * batchSize;
          const fixturesProcessedInBatch =
            results.length - fixturesProcessedBeforeBatch;
          const remainingFixtures = batch.slice(
            Math.max(0, fixturesProcessedInBatch)
          );

          logger.warn(
            `[VALIDATION] Adding error results for ${
              remainingFixtures.length
            } unprocessed fixtures in batch ${
              batchIndex + 1
            } (${fixturesProcessedInBatch} already processed)`
          );

          remainingFixtures.forEach((fixture) => {
            results.push({
              valid: false,
              status: "batch_error",
              fixtureId: fixture.id || fixture.attributes?.id,
              gameID: fixture.gameID || fixture.attributes?.gameID,
              url: fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
              error: errorMsg,
            });
          });
        } finally {
          // MEMORY OPTIMIZATION: Cleanup browser after each batch
          if (this.puppeteerManager) {
            try {
              logger.info(
                `[VALIDATION] Cleaning up browser after batch ${
                  batchIndex + 1
                }/${batches.length}`
              );
              // DO NOT dispose shared singleton - just close pages
              // Browser will be restarted automatically by PuppeteerManager based on memory/operation count
              await this.puppeteerManager.cleanupOrphanedPages();
            } catch (disposeError) {
              logger.warn(
                `[VALIDATION] Dispose error: ${disposeError.message}`
              );
            }
          }

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          // MEMORY FIX: Removed 2-second delay - GC hints and page DOM clearing are sufficient
          // This was a major speed bottleneck: 200 seconds overhead for 100 batches
          // Page DOM clearing and GC hints provide better memory management
        }
      }
    }

    // Final cleanup - dispose browser completely
    if (this.puppeteerManager) {
      try {
        logger.info("[VALIDATION] Final cleanup - closing orphaned pages");
        // DO NOT dispose shared singleton - just cleanup orphaned pages
        // Browser will be restarted automatically by PuppeteerManager based on memory/operation count
        await this.puppeteerManager.cleanupOrphanedPages();
        this.puppeteerManager = null;
        this.browser = null;
      } catch (error) {
        logger.warn(`[VALIDATION] Final cleanup error: ${error.message}`);
      }
    }

    const totalValid = results.filter((r) => r.valid).length;
    const totalInvalid = results.length - totalValid;

    // TESTING: Final verification
    const finalMemory = getMemoryStats();
    const memoryIncrease = {
      rss: finalMemory.rss - initialMemory.rss,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
    };

    // TESTING: Check for duplicates in final results
    const fixtureIds = results.map((r) => r.fixtureId);
    const gameIDs = results.map((r) => r.gameID);
    const uniqueFixtureIds = new Set(fixtureIds);
    const uniqueGameIDs = new Set(gameIDs);
    const duplicateFixtureIds = fixtureIds.length - uniqueFixtureIds.size;
    const duplicateGameIDs = gameIDs.length - uniqueGameIDs.size;

    logger.info(
      `[VALIDATION] Complete: ${totalValid} valid, ${totalInvalid} invalid out of ${results.length} fixtures`
    );

    // TESTING: Log final verification results
    logger.info(`[VALIDATION-TEST] Final Verification:`, {
      totalFixtures: fixtures.length,
      resultsCollected: results.length,
      expectedMatch: results.length === fixtures.length,
      duplicates: {
        fixtureIds: duplicateFixtureIds,
        gameIDs: duplicateGameIDs,
      },
      memory: {
        initial: `${initialMemory.rss}MB RSS, ${initialMemory.heapUsed}MB Heap`,
        final: `${finalMemory.rss}MB RSS, ${finalMemory.heapUsed}MB Heap`,
        increase: `+${memoryIncrease.rss}MB RSS, +${memoryIncrease.heapUsed}MB Heap`,
      },
    });

    // TESTING: Warn if results don't match expected count
    if (results.length !== fixtures.length) {
      logger.warn(
        `[VALIDATION-TEST] WARNING: Results count (${
          results.length
        }) does not match fixtures count (${fixtures.length}) - missing ${
          fixtures.length - results.length
        } results`
      );
    }

    // TESTING: Warn if duplicates found
    if (duplicateFixtureIds > 0 || duplicateGameIDs > 0) {
      logger.warn(
        `[VALIDATION-TEST] WARNING: Duplicates detected - ${duplicateFixtureIds} duplicate fixtureIds, ${duplicateGameIDs} duplicate gameIDs`
      );
    }

    return results;
  }
}

module.exports = FixtureValidationService;
