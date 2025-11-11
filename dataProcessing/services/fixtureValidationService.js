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
    this.timeout = options.timeout || 10000; // Reduced from 15000 to 10000
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

      // OPTIMIZATION: Use domcontentloaded (like other scrapers) - MUCH faster than networkidle0
      let response;
      try {
        response = await page.goto(fullUrl, {
          waitUntil: "domcontentloaded", // Fast - same as other scrapers
          timeout: this.timeout,
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

      // OPTIMIZATION: Wait for body to have content (quick check, max 2s)
      // This is much faster than networkidle0 or fixed delays
      try {
        await page.waitForFunction(
          () => document.body && document.body.innerText.length > 50,
          { timeout: 2000 }
        );
      } catch (waitError) {
        // If body doesn't load in 2s, likely a problem - check anyway
      }

      const httpStatus = response ? response.status() : "unknown";
      const finalUrl = page.url();

      // Check page content for 404 indicators and game content
      let pageInfo = {};
      try {
        pageInfo = await page.evaluate(() => {
          const bodyText = document.body
            ? document.body.innerText.toLowerCase()
            : "";

          // PlayHQ 404 page has: <h1>Oops, not another 404!</h1>
          const h1Elements = Array.from(document.querySelectorAll("h1"));
          const hasPlayHQ404H1 = h1Elements.some(
            (h1) =>
              h1.innerText &&
              h1.innerText.toLowerCase().includes("oops, not another 404")
          );
          const hasPlayHQ404Text =
            bodyText.includes("sorry you have arrived here") ||
            bodyText.includes("oops, not another 404");

          // Check for 404 indicators
          const has404Text =
            hasPlayHQ404H1 ||
            hasPlayHQ404Text ||
            bodyText.includes("404") ||
            bodyText.includes("not found") ||
            bodyText.includes("page not found");

          // Check for game content (teams, scores, dates, etc.)
          const hasGameContent =
            bodyText.match(/\b(vs|versus|team)\b/i) !== null ||
            bodyText.match(/\d+\s*-\s*\d+/) !== null || // Score pattern
            bodyText.includes("score") ||
            bodyText.includes("round") ||
            bodyText.includes("ground") ||
            bodyText.length > 1000; // Substantial content

          return {
            has404Text,
            hasGameContent,
            bodyLength: bodyText.length,
          };
        });
      } catch (contentError) {
        // If we can't check content, assume invalid
        logger.debug(`Could not check page content: ${contentError.message}`);
        return {
          valid: false,
          status: "error",
          fixtureId,
          gameID,
          url: fullUrl,
          error: contentError.message,
        };
      }

      // Check for 404 indicators first
      if (pageInfo.has404Text || httpStatus === 404) {
        logger.info(`[VALIDATION] 404: ${fullUrl}`);
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

      // For game center URLs, must have game content
      const isGameCenterUrl =
        finalUrl.includes("/game-centre/") ||
        finalUrl.includes("/game-center/");

      if (isGameCenterUrl && !pageInfo.hasGameContent) {
        logger.info(`[VALIDATION] 404: ${fullUrl} (no game content)`);
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

      // Valid if has game content or substantial content
      if (pageInfo.hasGameContent || pageInfo.bodyLength > 800) {
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

      // Default: treat as invalid if uncertain
      logger.info(`[VALIDATION] 404: ${fullUrl} (uncertain - no game content)`);
      return {
        valid: false,
        status: "404",
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
   * OPTIMIZED: Reuse browser across batches, process sequentially on single page
   */
  async validateFixturesBatch(fixtures, concurrencyLimit = 20) {
    const results = [];

    if (!this.usePuppeteer || this.skipHttpValidation) {
      logger.info(
        `[VALIDATION] Validating ${fixtures.length} fixtures using Puppeteer`
      );

      // OPTIMIZATION: Initialize browser once, reuse for all batches
      await this.initializeBrowser();
      if (!this.puppeteerManager) {
        throw new Error("PuppeteerManager not initialized");
      }

      let page = null;
      try {
        // Create a single page to reuse for all validations
        page = await this.puppeteerManager.createPageInNewContext();

        // Set user agent
        try {
          await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          );
        } catch (uaError) {
          // Ignore
        }

        // OPTIMIZATION: Block non-essential resources to speed up page loads
        try {
          await page.setRequestInterception(true);
          page.on("request", (request) => {
            const resourceType = request.resourceType();
            // Block images, fonts, media, stylesheets for faster loading
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

        // Process all fixtures sequentially on the same page
        // OPTIMIZATION: No batch cleanup - just process all fixtures on one page
        for (let i = 0; i < fixtures.length; i++) {
          const fixture = fixtures[i];
          const fixtureUrl =
            fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard;
          const fixtureId = fixture.id || fixture.attributes?.id;
          const fixtureGameID = fixture.gameID || fixture.attributes?.gameID;
          const fullUrl = fixtureUrl?.startsWith("http")
            ? fixtureUrl
            : `${this.domain}${fixtureUrl}`;

          // Log iteration start with URL
          logger.info(
            `[VALIDATION] Iteration ${i + 1}/${
              fixtures.length
            } - Processing URL: ${fullUrl}`
          );

          try {
            const result = await this.validateFixtureUrlWithPuppeteer(
              fixtureUrl,
              fixtureId,
              fixtureGameID,
              page
            );
            result.method = "puppeteer";

            // Log detailed result for every iteration: URL, Response, Verdict
            logger.info(
              `[VALIDATION] Iteration ${i + 1}/${fixtures.length} - RESULT`,
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
              `[VALIDATION] ${i + 1}/${
                fixtures.length
              } - ${verdict} | URL: ${fullUrl} | HTTP: ${
                result.httpStatus || "N/A"
              } | Status: ${result.status}`
            );

            results.push(result);

            // OPTIMIZATION: Minimal delay between validations (reduced to 25ms)
            if (i < fixtures.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 25));
            }

            // Log progress every 50 fixtures
            if ((i + 1) % 50 === 0) {
              const validCount = results.filter((r) => r.valid).length;
              const invalidCount = results.length - validCount;
              logger.info(
                `[VALIDATION] Progress Summary: ${i + 1}/${
                  fixtures.length
                } fixtures processed (${validCount} valid, ${invalidCount} invalid)`
              );
            }
          } catch (error) {
            // Log error with full details
            logger.error(
              `[VALIDATION] Iteration ${i + 1}/${fixtures.length} - ERROR`,
              {
                url: fullUrl,
                fixtureId,
                gameID: fixtureGameID,
                error: error.message,
                stack: error.stack,
              }
            );

            const errorResult = {
              valid: false,
              status: "error",
              fixtureId,
              gameID: fixtureGameID,
              url: fixtureUrl,
              error: error.message,
            };
            results.push(errorResult);

            // Log error result
            logger.info(
              `[VALIDATION] ${i + 1}/${
                fixtures.length
              } - ✗ ERROR | URL: ${fullUrl} | Error: ${error.message}`
            );
          }
        }
      } finally {
        // Cleanup: Close page and browser only once at the end
        try {
          if (page) {
            await page.close();
          }
        } catch (pageCloseError) {
          // Ignore
        }

        if (this.puppeteerManager) {
          try {
            await this.puppeteerManager.dispose();
            this.puppeteerManager = null;
            this.browser = null;
          } catch (disposeError) {
            logger.warn(`[VALIDATION] Dispose error: ${disposeError.message}`);
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
