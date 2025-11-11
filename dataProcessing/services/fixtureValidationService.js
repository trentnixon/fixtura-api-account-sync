const logger = require("../../src/utils/logger");
const fetch = require("node-fetch");
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");

/**
 * FixtureValidationService handles URL validation for fixtures.
 * Tests if fixture URLs return 404 errors or are still valid.
 * Uses Puppeteer for accurate validation of JavaScript-rendered pages.
 */
class FixtureValidationService {
  constructor(options = {}) {
    this.domain = "https://www.playhq.com";
    this.timeout = options.timeout || 15000; // Reduced from 30s to 15s for faster validation and less memory usage
    this.maxRetries = options.maxRetries || 2;
    this.usePuppeteer = options.usePuppeteer !== false; // Default to true for accuracy
    this.puppeteerManager = null;
    this.browser = null;
  }

  /**
   * Initialize Puppeteer browser if using Puppeteer validation
   */
  async initializeBrowser() {
    if (!this.usePuppeteer) {
      return;
    }
    if (!this.puppeteerManager) {
      this.puppeteerManager = new PuppeteerManager();
      await this.puppeteerManager.launchBrowser();
      this.browser = this.puppeteerManager.browser;
    }
  }

  /**
   * Cleanup Puppeteer browser
   */
  async cleanupBrowser() {
    // Don't close browser - let it be reused or closed by manager
    // The PuppeteerManager handles cleanup
  }

  /**
   * Validates a single fixture URL using Puppeteer (accurate for JS-rendered pages)
   * This method uses an existing page (reused for performance)
   * @param {string} urlToScoreCard - The URL to validate (relative or absolute)
   * @param {number} fixtureId - Database ID of the fixture
   * @param {string} gameID - Game ID of the fixture
   * @param {Page} page - Puppeteer page instance (reused for multiple validations)
   * @returns {Promise<Object>} Validation result { valid: boolean, status: string, error?: string }
   */
  async validateFixtureUrlWithPuppeteer(
    urlToScoreCard,
    fixtureId,
    gameID,
    page
  ) {
    if (!urlToScoreCard) {
      logger.warn(
        `No URL provided for fixture ${fixtureId} (gameID: ${gameID})`
      );
      return {
        valid: false,
        status: "no_url",
        fixtureId,
        gameID,
      };
    }

    // Construct full URL if relative
    const fullUrl = urlToScoreCard.startsWith("http")
      ? urlToScoreCard
      : `${this.domain}${urlToScoreCard}`;

    try {
      // Use the provided page (reused for multiple validations)
      if (!page) {
        throw new Error("Page instance is required for Puppeteer validation");
      }

      // Navigate to URL - check page content, not just HTTP status
      // PlayHQ might return 403 for access control, but page might still exist
      let response;
      try {
        response = await page.goto(fullUrl, {
          waitUntil: "domcontentloaded",
          timeout: this.timeout,
        });
      } catch (navError) {
        // If navigation fails completely, it's likely a 404
        if (navError.message && navError.message.includes("net::ERR_")) {
          logger.info(
            `[VALIDATION] Navigation failed for fixture URL (likely 404): ${fullUrl}`,
            {
              fixtureId,
              gameID,
              error: navError.message,
            }
          );
          // Don't close page - it's reused
          return {
            valid: false,
            status: "404",
            fixtureId,
            gameID,
            url: fullUrl,
            httpStatus: "navigation_failed",
          };
        }
        throw navError;
      }

      // Wait for page to render (reduced from 2000ms to 1000ms to reduce memory usage)
      // Use Promise-based setTimeout instead of deprecated waitForTimeout
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get HTTP status for logging
      const httpStatus = response ? response.status() : "unknown";

      // Check the final URL after navigation (check for redirects to 404 pages)
      const finalUrl = page.url();
      const isGameCenterUrl =
        finalUrl.includes("/game-centre/") ||
        finalUrl.includes("/game-center/");
      const is404Url =
        finalUrl.includes("/404") ||
        finalUrl.includes("not-found") ||
        finalUrl.includes("error");

      // Check page content for 404 indicators
      let pageInfo = {};
      try {
        pageInfo = await page.evaluate(() => {
          const bodyText = document.body
            ? document.body.innerText.toLowerCase()
            : "";
          const title = document.title ? document.title.toLowerCase() : "";
          const url = window.location.href;

          // Check for 404 indicators in content
          const has404Text =
            bodyText.includes("404") ||
            bodyText.includes("not found") ||
            bodyText.includes("page not found") ||
            bodyText.includes("doesn't exist");
          const has404Title =
            title.includes("404") || title.includes("not found");

          return {
            url: url,
            title: document.title,
            has404Text: has404Text,
            has404Title: has404Title,
            bodyLength: bodyText.length,
          };
        });
      } catch (contentError) {
        logger.debug(`Could not check page content for ${fullUrl}`, {
          fixtureId,
          gameID,
          error: contentError.message,
        });
      }

      // Don't close page - it's reused for multiple validations
      // Page will be closed by PuppeteerManager.dispose() at the end

      // Determine validity based on URL and content, not just HTTP status
      // For PlayHQ, 403 might just be access control, but page exists

      // If URL was redirected to a 404 page, it's invalid
      if (is404Url || pageInfo.has404Text || pageInfo.has404Title) {
        logger.info(`[VALIDATION] Fixture URL is a 404 page: ${fullUrl}`, {
          fixtureId,
          gameID,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        });
        return {
          valid: false,
          status: "404",
          fixtureId,
          gameID,
          url: fullUrl,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        };
      }

      // If HTTP status is 404, definitely invalid
      if (httpStatus === 404) {
        logger.info(`Fixture URL returned 404: ${fullUrl}`, {
          fixtureId,
          gameID,
          httpStatus: httpStatus,
        });
        return {
          valid: false,
          status: "404",
          fixtureId,
          gameID,
          url: fullUrl,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        };
      }

      // If URL is still a game center URL and page loaded, consider it valid
      // Even if HTTP status is 403 (access control), the page exists
      if (isGameCenterUrl && !pageInfo.has404Text && !pageInfo.has404Title) {
        // Only log invalid/404 cases - reduce verbosity for valid fixtures
        // logger.debug(`Fixture URL appears valid (page loaded): ${fullUrl}`);
        return {
          valid: true,
          status: httpStatus === 403 ? "valid_403" : "valid",
          fixtureId,
          gameID,
          url: fullUrl,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        };
      }

      // For 403, if page loaded and URL is correct, consider valid
      // (403 might just be access control, but page exists)
      if (httpStatus === 403 && !is404Url && !pageInfo.has404Text) {
        // Only log invalid/404 cases - reduce verbosity for valid fixtures
        // logger.info(`Fixture URL returned 403 but page loaded (likely access control): ${fullUrl}`);
        return {
          valid: true,
          status: "valid_403",
          fixtureId,
          gameID,
          url: fullUrl,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        };
      }

      // If page loaded successfully (200-299), consider it valid
      if (httpStatus >= 200 && httpStatus < 300) {
        // Only log invalid/404 cases - reduce verbosity for valid fixtures
        // logger.debug(`Fixture URL is valid: ${fullUrl}`);
        return {
          valid: true,
          status: "valid",
          fixtureId,
          gameID,
          url: fullUrl,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        };
      }

      // For other status codes, if page loaded, assume valid (could be redirects, etc.)
      logger.info(
        `[VALIDATION] Fixture URL loaded with status ${httpStatus} (assuming valid): ${fullUrl}`,
        {
          fixtureId,
          gameID,
          url: fullUrl,
          finalUrl: pageInfo.url || finalUrl,
          httpStatus: httpStatus,
        }
      );
      return {
        valid: true, // Assume valid unless we see 404 indicators
        status: `http_${httpStatus}`,
        fixtureId,
        gameID,
        url: fullUrl,
        finalUrl: pageInfo.url || finalUrl,
        httpStatus: httpStatus,
      };
    } catch (error) {
      // Don't close page here - it's reused and managed by PuppeteerManager
      // Check if it's a navigation error (likely 404 or network issue)
      if (error.message && error.message.includes("net::ERR_")) {
        logger.warn(`Navigation error for fixture URL: ${fullUrl}`, {
          fixtureId,
          gameID,
          error: error.message,
        });
        return {
          valid: false,
          status: "navigation_error",
          fixtureId,
          gameID,
          url: fullUrl,
          error: error.message,
        };
      }

      // Timeout or other errors
      const errorMessage = error.message || String(error);
      const errorStack = error.stack ? error.stack.substring(0, 200) : "";
      logger.error(
        `[VALIDATION] Error validating fixture URL with Puppeteer: ${fullUrl} - Error: ${errorMessage}${
          errorStack ? ` - Stack: ${errorStack}` : ""
        }`,
        {
          fixtureId,
          gameID,
          error: errorMessage,
          errorType: error.name || typeof error,
          errorStack: error.stack,
        }
      );
      return {
        valid: false,
        status: "error",
        fixtureId,
        gameID,
        url: fullUrl,
        error: errorMessage,
      };
    }
  }

  /**
   * Validates a single fixture URL by checking if it returns 404
   * Uses Puppeteer for accurate validation of JavaScript-rendered pages.
   * @param {string} urlToScoreCard - The URL to validate (relative or absolute)
   * @param {number} fixtureId - Database ID of the fixture
   * @param {string} gameID - Game ID of the fixture
   * @returns {Promise<Object>} Validation result { valid: boolean, status: string, error?: string }
   */
  async validateFixtureUrl(urlToScoreCard, fixtureId, gameID, page = null) {
    // Use Puppeteer for accurate validation
    if (this.usePuppeteer) {
      if (!page) {
        throw new Error(
          "Page instance is required when using Puppeteer validation"
        );
      }
      return await this.validateFixtureUrlWithPuppeteer(
        urlToScoreCard,
        fixtureId,
        gameID,
        page
      );
    }

    // Fallback to HTTP fetch (faster but less accurate for JS-rendered pages)
    return await this.validateFixtureUrlWithFetch(
      urlToScoreCard,
      fixtureId,
      gameID
    );
  }

  /**
   * Validates a single fixture URL using HTTP fetch (faster but less accurate)
   * @param {string} urlToScoreCard - The URL to validate (relative or absolute)
   * @param {number} fixtureId - Database ID of the fixture
   * @param {string} gameID - Game ID of the fixture
   * @returns {Promise<Object>} Validation result { valid: boolean, status: string, error?: string }
   */
  async validateFixtureUrlWithFetch(urlToScoreCard, fixtureId, gameID) {
    if (!urlToScoreCard) {
      logger.warn(
        `No URL provided for fixture ${fixtureId} (gameID: ${gameID})`
      );
      return {
        valid: false,
        status: "no_url",
        fixtureId,
        gameID,
      };
    }

    // Construct full URL if relative
    const fullUrl = urlToScoreCard.startsWith("http")
      ? urlToScoreCard
      : `${this.domain}${urlToScoreCard}`;

    let retryCount = 0;
    while (retryCount <= this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(fullUrl, {
          method: "HEAD", // Use HEAD to check status without downloading content
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        if (response.status === 404) {
          logger.info(`Fixture URL returned 404: ${fullUrl}`, {
            fixtureId,
            gameID,
            status: response.status,
          });
          return {
            valid: false,
            status: "404",
            fixtureId,
            gameID,
            url: fullUrl,
          };
        }

        if (response.status >= 200 && response.status < 400) {
          logger.debug(`Fixture URL is valid: ${fullUrl}`, {
            fixtureId,
            gameID,
            status: response.status,
          });
          return {
            valid: true,
            status: "valid",
            fixtureId,
            gameID,
            url: fullUrl,
            httpStatus: response.status,
          };
        }

        // Other error statuses
        logger.warn(
          `Fixture URL returned unexpected status: ${response.status}`,
          {
            fixtureId,
            gameID,
            url: fullUrl,
            status: response.status,
          }
        );
        return {
          valid: false,
          status: `http_${response.status}`,
          fixtureId,
          gameID,
          url: fullUrl,
          httpStatus: response.status,
        };
      } catch (error) {
        retryCount++;

        if (error.name === "AbortError") {
          logger.warn(
            `Fixture URL validation timeout after ${this.timeout}ms: ${fullUrl}`,
            {
              fixtureId,
              gameID,
              retryCount,
            }
          );
          if (retryCount > this.maxRetries) {
            return {
              valid: false,
              status: "timeout",
              fixtureId,
              gameID,
              url: fullUrl,
              error: error.message,
            };
          }
          // Retry on timeout
          continue;
        }

        if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
          logger.error(`Connection error validating fixture URL: ${fullUrl}`, {
            fixtureId,
            gameID,
            error: error.message,
            code: error.code,
          });
          return {
            valid: false,
            status: "connection_error",
            fixtureId,
            gameID,
            url: fullUrl,
            error: error.message,
          };
        }

        // Other errors
        logger.error(`Error validating fixture URL: ${fullUrl}`, {
          fixtureId,
          gameID,
          error: error.message,
          retryCount,
        });

        if (retryCount > this.maxRetries) {
          return {
            valid: false,
            status: "error",
            fixtureId,
            gameID,
            url: fullUrl,
            error: error.message,
          };
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Should not reach here, but just in case
    return {
      valid: false,
      status: "unknown_error",
      fixtureId,
      gameID,
      url: fullUrl,
    };
  }

  /**
   * Validates multiple fixture URLs sequentially using Puppeteer with memory optimization
   * Processes in smaller batches with browser cleanup between batches to reduce memory usage
   * @param {Array<Object>} fixtures - Array of fixture objects with { id, gameID, urlToScoreCard }
   * @param {number} concurrencyLimit - Batch size for processing (default: 20 fixtures per batch for memory optimization)
   * @returns {Promise<Array<Object>>} Array of validation results
   */
  async validateFixturesBatch(fixtures, concurrencyLimit = 20) {
    const results = [];

    if (this.usePuppeteer) {
      // MEMORY OPTIMIZATION: Process in smaller batches with browser cleanup between batches
      // This prevents memory accumulation when validating hundreds of fixtures
      const batchSize = concurrencyLimit; // Process N fixtures per batch
      const batches = [];
      for (let i = 0; i < fixtures.length; i += batchSize) {
        batches.push(fixtures.slice(i, i + batchSize));
      }

      logger.info(
        `[VALIDATION] Validating ${fixtures.length} fixtures in ${batches.length} batches (${batchSize} fixtures per batch, timeout: ${this.timeout}ms)`
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
            logger.warn(`Failed to set user agent: ${uaError.message}`);
          }

          // Disable images and other resources to reduce memory usage
          // Only block non-essential resources (images, fonts, media)
          // Keep HTML, CSS, scripts, and XHR/fetch requests for accurate validation
          try {
            await page.setRequestInterception(true);
            page.on("request", (request) => {
              const resourceType = request.resourceType();
              // Block images, fonts, media, websockets to save memory
              // But allow document, script, stylesheet, xhr, fetch for validation
              if (
                ["image", "font", "media", "websocket", "manifest"].includes(
                  resourceType
                )
              ) {
                request.abort();
              } else {
                request.continue();
              }
            });
          } catch (interceptError) {
            // If request interception fails, continue without it
            // This is not critical - just reduces memory savings
            logger.debug(
              `Request interception not available: ${interceptError.message}`
            );
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

            try {
              const result = await this.validateFixtureUrl(
                fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
                fixture.id || fixture.attributes?.id,
                fixture.gameID || fixture.attributes?.gameID,
                page
              );
              results.push(result);

              // Clear page cache after each validation to free memory
              try {
                // Clear cookies and cache
                const client = await page.target().createCDPSession();
                await client.send("Network.clearBrowserCookies");
                await client.send("Network.clearBrowserCache");
                await client.detach();
              } catch (clearError) {
                // Ignore cache clearing errors
              }

              // Log progress every 10 fixtures
              if (
                (globalIndex + 1) % 10 === 0 ||
                globalIndex === fixtures.length - 1
              ) {
                const validCount = results.filter((r) => r.valid).length;
                const invalidCount = results.length - validCount;
                logger.info(
                  `[VALIDATION] Progress: ${globalIndex + 1}/${
                    fixtures.length
                  } fixtures validated (${validCount} valid, ${invalidCount} invalid)`
                );
              }
            } catch (error) {
              logger.error(
                `Error validating fixture ${globalIndex + 1}/${
                  fixtures.length
                }: ${error.message}`
              );
              results.push({
                valid: false,
                status: "error",
                fixtureId: fixture.id || fixture.attributes?.id,
                gameID: fixture.gameID || fixture.attributes?.gameID,
                url:
                  fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
                error: error.message,
              });
            }

            // Small delay between validations (reduced from 500ms to 200ms)
            if (i < batch.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }

          // Close page after batch to free memory
          try {
            if (page) {
              await page.close();
              page = null;
            }
          } catch (pageCloseError) {
            logger.warn(`Error closing page: ${pageCloseError.message}`);
          }
        } catch (batchError) {
          logger.error(
            `Error processing batch ${batchIndex + 1}: ${batchError.message}`
          );
          // Mark all fixtures in this batch as errors
          batch.forEach((fixture) => {
            results.push({
              valid: false,
              status: "batch_error",
              fixtureId: fixture.id || fixture.attributes?.id,
              gameID: fixture.gameID || fixture.attributes?.gameID,
              url: fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
              error: batchError.message,
            });
          });
        } finally {
          // Cleanup: Close browser after each batch to free memory
          // This is the key optimization - restart browser between batches
          logger.info(
            `[VALIDATION] Cleaning up Puppeteer browser after batch ${
              batchIndex + 1
            }/${batches.length}`
          );
          if (this.puppeteerManager) {
            try {
              await this.puppeteerManager.dispose();
              this.puppeteerManager = null;
              this.browser = null;
              logger.info(
                `[VALIDATION] Puppeteer browser disposed after batch ${
                  batchIndex + 1
                }`
              );
            } catch (disposeError) {
              logger.warn(`Error disposing browser: ${disposeError.message}`);
            }
          }

          // Force garbage collection hint (if available)
          if (global.gc) {
            global.gc();
          }

          // Small delay between batches to allow memory cleanup
          if (batchIndex < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    } else {
      // For HTTP validation, process in parallel batches
      const batches = [];
      for (let i = 0; i < fixtures.length; i += concurrencyLimit) {
        batches.push(fixtures.slice(i, i + concurrencyLimit));
      }

      logger.info(
        `Validating ${fixtures.length} fixtures in ${batches.length} batches (concurrency: ${concurrencyLimit}, method: HTTP)`
      );

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchResults = await Promise.all(
          batch.map((fixture) =>
            this.validateFixtureUrl(
              fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
              fixture.id || fixture.attributes?.id,
              fixture.gameID || fixture.attributes?.gameID
            )
          )
        );
        results.push(...batchResults);

        const validCount = batchResults.filter((r) => r.valid).length;
        const invalidCount = batchResults.length - validCount;
        logger.info(
          `Batch ${batchIndex + 1}/${
            batches.length
          } complete: ${validCount} valid, ${invalidCount} invalid`
        );
      }
    }

    const totalValid = results.filter((r) => r.valid).length;
    const totalInvalid = results.length - totalValid;
    logger.info(
      `[VALIDATION] Validation complete: ${totalValid} valid, ${totalInvalid} invalid out of ${results.length} fixtures`
    );

    return results;
  }
}

module.exports = FixtureValidationService;
