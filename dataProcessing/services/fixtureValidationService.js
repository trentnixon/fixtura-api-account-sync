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
    // PlayHQ blocks HEAD/GET requests (403), so we need to use Puppeteer for all validations
    // However, we optimize by processing in small batches and closing browser between batches
    this.usePuppeteer = options.usePuppeteer !== false; // Default to true (required for PlayHQ)
    this.usePuppeteerFallback = options.usePuppeteerFallback !== false; // Use Puppeteer for uncertain HTTP responses (403, etc.)
    // Skip HTTP validation by default for PlayHQ (we know it blocks HTTP requests)
    // Set to false if you want to test HTTP first (e.g., for other domains)
    this.skipHttpValidation =
      options.skipHttpValidation !== undefined
        ? options.skipHttpValidation
        : true; // Default: true (skip HTTP for PlayHQ)
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
   * Validates a single fixture URL using hybrid approach:
   * 1. Try HTTP first (fast, no browser process)
   * 2. Fall back to Puppeteer only for uncertain cases (403, timeouts, etc.)
   * This eliminates browser processes for 90%+ of validations, reducing memory by 90%+
   * @param {string} urlToScoreCard - The URL to validate (relative or absolute)
   * @param {number} fixtureId - Database ID of the fixture
   * @param {string} gameID - Game ID of the fixture
   * @param {Page} page - Puppeteer page instance (only used for fallback validation)
   * @returns {Promise<Object>} Validation result { valid: boolean, status: string, error?: string, method: 'http' | 'puppeteer' }
   */
  async validateFixtureUrl(urlToScoreCard, fixtureId, gameID, page = null) {
    // If HTTP validation is disabled or we have a page available, skip HTTP and use Puppeteer directly
    // This is more efficient for PlayHQ which blocks HEAD/GET requests
    if (this.skipHttpValidation && page !== null) {
      return await this.validateFixtureUrlWithPuppeteer(
        urlToScoreCard,
        fixtureId,
        gameID,
        page
      );
    }

    // Step 1: Try HTTP validation first (fast, no browser process)
    const httpResult = await this.validateFixtureUrlWithFetch(
      urlToScoreCard,
      fixtureId,
      gameID
    );

    // Step 2: If HTTP returns clear result (404 or 200-299), use it
    // Clear 404 - definitely invalid
    if (httpResult.status === "404") {
      return { ...httpResult, method: "http" };
    }

    // Clear 200-299 - likely valid (no need for Puppeteer)
    if (
      httpResult.status === "valid" &&
      httpResult.httpStatus >= 200 &&
      httpResult.httpStatus < 300
    ) {
      return { ...httpResult, method: "http" };
    }

    // Step 3: For uncertain cases (403, timeouts, errors), use Puppeteer if enabled
    // Uncertain statuses that need Puppeteer verification:
    const uncertainStatuses = [
      "http_403",
      "http_401",
      "timeout",
      "error",
      "connection_error",
    ];
    const needsPuppeteer =
      this.usePuppeteerFallback &&
      uncertainStatuses.includes(httpResult.status) &&
      page !== null;

    if (needsPuppeteer) {
      logger.debug(
        `[VALIDATION] HTTP returned uncertain status (${httpResult.status}), using Puppeteer fallback for ${urlToScoreCard}`
      );
      try {
        const puppeteerResult = await this.validateFixtureUrlWithPuppeteer(
          urlToScoreCard,
          fixtureId,
          gameID,
          page
        );
        return {
          ...puppeteerResult,
          method: "puppeteer",
          httpStatus: httpResult.httpStatus,
        };
      } catch (puppeteerError) {
        logger.warn(
          `[VALIDATION] Puppeteer fallback failed, using HTTP result: ${puppeteerError.message}`
        );
        // If Puppeteer fails, return HTTP result
        return { ...httpResult, method: "http" };
      }
    }

    // Step 4: If Puppeteer fallback is disabled or page is not available, return HTTP result
    // For 403 and other uncertain statuses, we'll mark as invalid if Puppeteer is not available
    // This is a trade-off: we prefer false positives (mark valid as invalid) over false negatives (mark invalid as valid)
    if (uncertainStatuses.includes(httpResult.status)) {
      logger.debug(
        `[VALIDATION] HTTP returned uncertain status (${httpResult.status}), but Puppeteer fallback is disabled. Marking as invalid.`
      );
      return { ...httpResult, valid: false, method: "http" };
    }

    // Return HTTP result for all other cases
    return { ...httpResult, method: "http" };
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

        // PlayHQ blocks HEAD requests (403), so use GET with Range header to minimize data transfer
        // Request only first byte to check if page exists without downloading full content
        const response = await fetch(fullUrl, {
          method: "GET",
          headers: {
            Range: "bytes=0-0", // Only request first byte to check if page exists
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        // Check status code
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

        // 206 Partial Content means page exists (Range request succeeded)
        // 200 OK also means page exists
        if (response.status === 200 || response.status === 206) {
          logger.debug(
            `Fixture URL is valid: ${fullUrl} (status: ${response.status})`,
            {
              fixtureId,
              gameID,
              status: response.status,
            }
          );
          return {
            valid: true,
            status: "valid",
            fixtureId,
            gameID,
            url: fullUrl,
            httpStatus: response.status,
          };
        }

        // 403 Forbidden - PlayHQ might block automated requests, but page might still exist
        // Treat as uncertain (will use Puppeteer fallback)
        if (response.status === 403) {
          logger.debug(
            `Fixture URL returned 403 (uncertain - will use Puppeteer): ${fullUrl}`,
            {
              fixtureId,
              gameID,
              status: response.status,
            }
          );
          return {
            valid: false, // Mark as invalid initially, Puppeteer will verify
            status: "http_403",
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

    // OPTIMIZATION: Try HTTP validation on first few fixtures to detect if it's blocked
    // If all return 403, skip HTTP validation for remaining fixtures (PlayHQ blocks HTTP)
    let httpBlocked = false;
    const httpTestSize = Math.min(5, fixtures.length); // Test first 5 fixtures

    if (!this.skipHttpValidation && httpTestSize > 0) {
      logger.info(
        `[VALIDATION] Testing HTTP validation on first ${httpTestSize} fixtures to detect if PlayHQ blocks HTTP requests`
      );

      const httpTestResults = await Promise.all(
        fixtures
          .slice(0, httpTestSize)
          .map((fixture) =>
            this.validateFixtureUrlWithFetch(
              fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
              fixture.id || fixture.attributes?.id,
              fixture.gameID || fixture.attributes?.gameID
            ).catch(() => ({ status: "error" }))
          )
      );

      // If all test fixtures return 403, HTTP is blocked - skip HTTP validation for all fixtures
      const all403 = httpTestResults.every((r) => r.status === "http_403");
      if (all403) {
        httpBlocked = true;
        logger.info(
          `[VALIDATION] PlayHQ is blocking HTTP requests (all ${httpTestSize} test fixtures returned 403). Skipping HTTP validation and using Puppeteer directly for ALL fixtures (including test fixtures).`
        );
      } else {
        logger.info(
          `[VALIDATION] HTTP validation appears to work (${
            httpTestResults.filter((r) => r.status !== "http_403").length
          }/${httpTestSize} succeeded). Using hybrid approach.`
        );
        // Add successful HTTP results for test fixtures
        httpTestResults.forEach((result) => {
          if (result.status === "404") {
            // Clear 404 - definitely invalid, no Puppeteer needed
            results.push({ ...result, method: "http" });
          } else if (
            result.status === "valid" &&
            result.httpStatus >= 200 &&
            result.httpStatus < 300
          ) {
            // Clear 200-206 - valid, no Puppeteer needed
            results.push({ ...result, method: "http" });
          }
          // Uncertain results (403, etc.) will be validated with Puppeteer below
        });
      }
    }

    // Use Puppeteer if: explicitly enabled, HTTP is blocked, or HTTP validation is skipped
    if (this.usePuppeteer || httpBlocked || this.skipHttpValidation) {
      // MEMORY OPTIMIZATION: Process in smaller batches with browser cleanup between batches
      // This prevents memory accumulation when validating hundreds of fixtures
      const batchSize = concurrencyLimit; // Process N fixtures per batch
      const batches = [];
      for (let i = 0; i < fixtures.length; i += batchSize) {
        batches.push(fixtures.slice(i, i + batchSize));
      }

      const method = this.skipHttpValidation
        ? "Puppeteer only (HTTP skipped)"
        : httpBlocked
        ? "Puppeteer only (HTTP blocked)"
        : "Puppeteer";
      logger.info(
        `[VALIDATION] Validating ${fixtures.length} fixtures using ${method} in ${batches.length} batches (${batchSize} fixtures per batch, timeout: ${this.timeout}ms)`
      );

      // Process each batch separately with browser cleanup between batches
      // If HTTP was blocked, validate ALL fixtures (including test fixtures) with Puppeteer
      // If HTTP worked, only validate fixtures that need Puppeteer (uncertain HTTP results)
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

            // If HTTP validation worked and we already have a result for this fixture, skip it
            if (
              !httpBlocked &&
              !this.skipHttpValidation &&
              globalIndex < httpTestSize
            ) {
              // Check if we already have a valid HTTP result for this fixture
              const existingResult = results.find(
                (r) =>
                  r.fixtureId === (fixture.id || fixture.attributes?.id) &&
                  r.gameID === (fixture.gameID || fixture.attributes?.gameID) &&
                  (r.method === "http" ||
                    r.status === "404" ||
                    (r.status === "valid" &&
                      r.httpStatus >= 200 &&
                      r.httpStatus < 300))
              );
              if (existingResult) {
                // Already validated with HTTP, skip Puppeteer
                continue;
              }
            }

            try {
              // If HTTP is blocked, skip HTTP validation and use Puppeteer directly
              let result;
              if (httpBlocked || this.skipHttpValidation) {
                result = await this.validateFixtureUrlWithPuppeteer(
                  fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
                  fixture.id || fixture.attributes?.id,
                  fixture.gameID || fixture.attributes?.gameID,
                  page
                );
                result.method = "puppeteer";
              } else {
                result = await this.validateFixtureUrl(
                  fixture.urlToScoreCard || fixture.attributes?.urlToScoreCard,
                  fixture.id || fixture.attributes?.id,
                  fixture.gameID || fixture.attributes?.gameID,
                  page
                );
              }
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
