const logger = require("../../src/utils/logger");
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");

/**
 * FixtureValidationService handles URL validation for fixtures.
 * Uses Puppeteer to validate JavaScript-rendered pages and detect 404s.
 * OPTIMIZED: Uses same pattern as other scrapers (domcontentloaded + waitForSelector)
 */
class FixtureValidationService {
  constructor(options = {}) {
    this.domain = "https://www.playhq.com";
    this.timeout = options.timeout || 8000; // Optimized: 8 seconds (reduced from 10000)
    this.skipHttpValidation = options.skipHttpValidation !== false; // Default: true (PlayHQ blocks HTTP)
    this.usePuppeteer = options.usePuppeteer !== false; // Default: true
    this.puppeteerManager = null;
    this.browser = null;
  }

  async initializeBrowser() {
    if (!this.usePuppeteer || this.puppeteerManager) return;
    this.puppeteerManager = new PuppeteerManager();
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

      // OPTIMIZED: Use domcontentloaded (like other scrapers) - MUCH faster than networkidle0
      // Reduced timeout for faster failure detection
      let response;
      try {
        response = await page.goto(fullUrl, {
          waitUntil: "domcontentloaded", // Fast - same as other scrapers
          timeout: this.timeout, // 8 seconds (optimized)
        });
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

      // OPTIMIZED: Wait for page content efficiently (PlayHQ is a SPA)
      // Use waitForFunction to wait for actual content instead of fixed delays
      try {
        // Check if page is still connected
        if (page.isClosed()) {
          throw new Error("Page is closed");
        }
        // Wait for body to exist (quick check)
        await page.waitForSelector("body", { timeout: 2000 });

        // OPTIMIZED: Wait for content to load using waitForFunction (faster than fixed delay)
        // Wait for body to have some content (indicating page has rendered)
        try {
          await page.waitForFunction(
            () => {
              const body = document.body;
              return body && body.innerText && body.innerText.length > 100;
            },
            { timeout: 2000 }
          );
        } catch (waitFuncError) {
          // If waitForFunction times out, give a short delay and continue
          // (page might still be loading but we can check what's there)
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (waitError) {
        // If body doesn't load or page is closed, return error result
        if (
          waitError.message.includes("closed") ||
          waitError.message.includes("Target closed")
        ) {
          throw new Error(`Page closed during wait: ${waitError.message}`);
        }
        // If timeout, continue to check content anyway (page might still have content)
        logger.debug(
          `[VALIDATION] Wait error for ${fullUrl}: ${waitError.message}`
        );
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

      // PRIORITY 1: Check for EXPLICIT PlayHQ 404 indicators ONLY
      // Only mark as 404 if we see the specific PlayHQ 404 page structure
      if (pageInfo.hasExplicit404 || httpStatus === 404) {
        logger.info(`[VALIDATION] 404 detected (explicit): ${fullUrl}`, {
          hasPlayHQ404H1: pageInfo.hasPlayHQ404H1,
          hasPlayHQ404Text: pageInfo.hasPlayHQ404Text,
          httpStatus,
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
    const results = [];

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
        let page = null;

        try {
          // Initialize browser for this batch
          await this.initializeBrowser();
          if (!this.puppeteerManager) {
            throw new Error("PuppeteerManager not initialized");
          }

          // Create a new page for this batch
          page = await this.puppeteerManager.createPageInNewContext();

          // Set user agent
          try {
            await page.setUserAgent(
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );
          } catch (uaError) {
            // Ignore
          }

          // MEMORY OPTIMIZATION: Block non-essential resources aggressively
          try {
            await page.setRequestInterception(true);
            page.on("request", (request) => {
              const resourceType = request.resourceType();
              // Block everything except document and script (needed for SPA)
              if (
                [
                  "image",
                  "font",
                  "media",
                  "websocket",
                  "manifest",
                  "stylesheet",
                ].includes(resourceType)
              ) {
                request.abort();
              } else {
                request.continue();
              }
            });
          } catch (interceptError) {
            // Ignore - request interception not critical
          }

          logger.info(
            `[VALIDATION] Processing batch ${batchIndex + 1}/${
              batches.length
            } (${batch.length} fixtures)`
          );

          // Process fixtures in this batch sequentially
          for (let i = 0; i < batch.length; i++) {
            const fixture = batch[i];
            const globalIndex = batchIndex * batchSize + i;
            const fixtureUrl =
              fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard;
            const fixtureId = fixture.id || fixture.attributes?.id;
            const fixtureGameID = fixture.gameID || fixture.attributes?.gameID;
            const fullUrl = fixtureUrl?.startsWith("http")
              ? fixtureUrl
              : `${this.domain}${fixtureUrl}`;

            // Log iteration start with URL
            logger.info(
              `[VALIDATION] Iteration ${globalIndex + 1}/${
                fixtures.length
              } - Processing URL: ${fullUrl}`
            );

            try {
              // Check if page is still valid before validation
              if (!page || page.isClosed()) {
                throw new Error("Page is closed or invalid - cannot validate");
              }

              const result = await this.validateFixtureUrlWithPuppeteer(
                fixtureUrl,
                fixtureId,
                fixtureGameID,
                page
              );
              result.method = "puppeteer";

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

              results.push(result);

              // OPTIMIZED: Minimal delay between validations (reduced from 100ms to 50ms)
              // Small delay to prevent overwhelming the page
              if (i < batch.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
            } catch (error) {
              // Log error with full details
              const errorMsg = error.message || String(error);
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

              const errorResult = {
                valid: false,
                status: "error",
                fixtureId,
                gameID: fixtureGameID,
                url: fixtureUrl,
                error: errorMsg,
              };
              results.push(errorResult);

              // Log error result
              logger.info(
                `[VALIDATION] ${globalIndex + 1}/${
                  fixtures.length
                } - ✗ ERROR | URL: ${fullUrl} | Error: ${errorMsg}`
              );

              // If page is closed/disconnected, we need to break and recreate the browser
              if (
                errorMsg.includes("closed") ||
                errorMsg.includes("Target closed") ||
                errorMsg.includes("Session closed") ||
                errorMsg.includes("Protocol error") ||
                errorMsg.includes("Page disconnected") ||
                errorMsg.includes("Navigation failed")
              ) {
                logger.warn(
                  `[VALIDATION] Page disconnected for iteration ${
                    globalIndex + 1
                  }, breaking batch to recreate browser`
                );
                // Break out of inner loop to trigger browser cleanup
                break;
              }
            }
          }

          // Close page after batch (safely)
          try {
            if (page && !page.isClosed()) {
              await page.close().catch(() => {
                // Ignore close errors - page might already be closed
              });
            }
            page = null;
          } catch (pageCloseError) {
            // Ignore - page might already be closed
            logger.debug(
              `[VALIDATION] Page close error (ignored): ${pageCloseError.message}`
            );
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
              await this.puppeteerManager.dispose();
              this.puppeteerManager = null;
              this.browser = null;
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

          // OPTIMIZED: Reduced wait between batches (memory issue is fixed)
          // Short delay to allow browser cleanup to complete
          if (batchIndex < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    const totalValid = results.filter((r) => r.valid).length;
    const totalInvalid = results.length - totalValid;
    logger.info(
      `[VALIDATION] Complete: ${totalValid} valid, ${totalInvalid} invalid out of ${results.length} fixtures`
    );

    return results;
  }
}

module.exports = FixtureValidationService;
