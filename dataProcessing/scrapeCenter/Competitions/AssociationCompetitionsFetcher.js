const logger = require("../../../src/utils/logger");

class AssociationCompetitionsFetcher {
  constructor(page, url, associationID) {
    this.page = page;
    this.url = url;
    this.associationID = associationID;
  }

  /**
   * Optimize page for competitions scraping by blocking non-essential resources
   * This significantly speeds up page loading
   */
  async optimizePageForCompetitions() {
    try {
      await this.page.setRequestInterception(true);
      this.page.on("request", (request) => {
        const resourceType = request.resourceType();
        const url = request.url();

        // Block non-essential resources to speed up loading
        if (
          resourceType === "image" ||
          resourceType === "font" ||
          resourceType === "media" ||
          resourceType === "websocket" ||
          resourceType === "manifest" ||
          // Block analytics and tracking
          url.includes("analytics") ||
          url.includes("tracking") ||
          url.includes("google-analytics") ||
          url.includes("googletagmanager") ||
          url.includes("facebook.net") ||
          url.includes("doubleclick") ||
          url.includes("adservice") ||
          // Block ads
          url.includes("/ads/") ||
          url.includes("/advertisement") ||
          // Block social media widgets
          url.includes("twitter") ||
          url.includes("instagram") ||
          url.includes("linkedin")
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });
      logger.debug(
        "[PARALLEL_COMPETITIONS] Page optimized for competitions scraping (blocked images/fonts/media/analytics)"
      );
    } catch (error) {
      logger.debug(
        "[PARALLEL_COMPETITIONS] Request interception already configured"
      );
    }
  }

  async fetchCompetitions() {
    try {
      logger.info(
        `[AssociationCompetitionsFetcher] Starting fetchCompetitions - URL: ${this.url}, Association ID: ${this.associationID}`
      );
      logger.debug(
        `Checking competitions in fetchCompetitionInAssociation on URL: ${this.url} and this ID ${this.associationID}`
      );

      // Optimize page for competitions scraping before navigation
      await this.optimizePageForCompetitions();

      const navStartTime = Date.now();
      logger.info(`[PARALLEL_COMPETITIONS] [NAV] Navigating to ${this.url}`);
      await this.navigateToUrl();
      const navDuration = Date.now() - navStartTime;
      logger.info(
        `[PARALLEL_COMPETITIONS] [NAV] Navigation complete: ${navDuration}ms`
      );

      // Wait for dynamic content to load (especially important with proxy latency)
      // PlayHQ uses React/SPA, so content loads after initial page load
      // Wait for the season-org container to start appearing (indicates React has rendered)
      await this.page
        .waitForSelector('[data-testid^="season-org-"]', {
          timeout: 5000,
          visible: false, // Just check if element exists in DOM, not necessarily visible yet
        })
        .catch(() => {}); // Non-blocking - continue if timeout

      const waitStartTime = Date.now();
      await this.waitForPageLoad();
      const waitDuration = Date.now() - waitStartTime;
      logger.info(
        `[PARALLEL_COMPETITIONS] [WAIT] Page load complete: ${waitDuration}ms`
      );

      const extractStartTime = Date.now();
      const competitions = await this.extractCompetitionsData();
      const extractDuration = Date.now() - extractStartTime;
      logger.info(
        `[PARALLEL_COMPETITIONS] [EXTRACT] Extraction complete: ${extractDuration}ms (total: ${
          Date.now() - navStartTime
        }ms)`
      );
      logger.info(
        `[AssociationCompetitionsFetcher] Extracted ${
          competitions ? competitions.length : 0
        } competitions`,
        {
          competitionsCount: competitions ? competitions.length : 0,
          competitions: competitions,
        }
      );

      return competitions;
    } catch (error) {
      logger.error(
        `[AssociationCompetitionsFetcher] Error in fetching competitions for association`,
        {
          error: error.message,
          errorName: error.name,
          url: this.url,
          associationID: this.associationID,
          stack: error.stack,
          pageExists: !!this.page,
          pageClosed: this.page ? this.page.isClosed() : null,
          pageUrl: this.page ? this.page.url() : null,
        }
      );
      throw error;
    }
  }

  async navigateToUrl() {
    try {
      // Try load first (faster) - competitions page structure is simple, doesn't need networkidle2
      await this.page.goto(this.url, {
        timeout: 30000, // Reduced to 30 seconds - should be enough with resource blocking
        waitUntil: "load", // Faster than networkidle2 - page structure loads quickly
      });
    } catch (navError) {
      // If load times out, try domcontentloaded as fallback
      logger.warn(
        `[PARALLEL_COMPETITIONS] [NAV] Load timeout, trying domcontentloaded fallback`
      );
      try {
        await this.page.goto(this.url, {
          timeout: 30000,
          waitUntil: "domcontentloaded",
        });
        // Give extra time for dynamic content to load - wait for season-org container to appear
        await this.page
          .waitForSelector('[data-testid^="season-org-"]', {
            timeout: 5000,
            visible: false, // Just check if element exists in DOM
          })
          .catch(() => {});
      } catch (domError) {
        // Last resort: just wait for selector after navigation
        logger.warn(
          `[PARALLEL_COMPETITIONS] [NAV] domcontentloaded timeout, waiting for content selector`
        );
        await this.page
          .waitForSelector('[data-testid^="season-org-"]', {
            timeout: 10000,
            visible: false,
          })
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
      // OPTIMIZED: Faster checks with shorter timeouts
      // Step 1: Wait for the season-org container to exist in DOM first
      const elapsedBeforeContainer = Date.now() - waitStartTime;
      const remainingTimeForContainer =
        MAX_TOTAL_WAIT_TIME - elapsedBeforeContainer;

      if (remainingTimeForContainer <= 0) {
        logger.warn(
          `[PARALLEL_COMPETITIONS] [WAIT] Max wait time exceeded before checking container`,
          {
            url: this.url,
            elapsed: elapsedBeforeContainer,
          }
        );
        throw new Error(
          `Page structure not found after ${MAX_TOTAL_WAIT_TIME}ms - likely page structure changed`
        );
      }

      try {
        const timeoutForContainer = Math.min(
          QUICK_CHECK_TIMEOUT,
          remainingTimeForContainer
        );
        await this.page.waitForSelector('[data-testid^="season-org-"]', {
          timeout: timeoutForContainer,
          visible: false, // First check if element exists in DOM
        });
        logger.debug(`Season-org container found in DOM`, {
          url: this.url,
          waitTime: Date.now() - waitStartTime,
        });
      } catch (selectorError) {
        const elapsed = Date.now() - waitStartTime;
        const remainingTime = MAX_TOTAL_WAIT_TIME - elapsed;

        if (remainingTime <= 0) {
          logger.warn(
            `[PARALLEL_COMPETITIONS] [WAIT] Max wait time exceeded, failing fast`,
            {
              url: this.url,
              elapsed,
            }
          );
          throw new Error(
            `Page structure not found after ${MAX_TOTAL_WAIT_TIME}ms - likely page structure changed`
          );
        }
        // Try visible check as fallback (with remaining time)
        try {
          const timeoutForVisible = Math.min(1000, remainingTime);
          await this.page.waitForSelector('[data-testid^="season-org-"]', {
            timeout: timeoutForVisible,
            visible: true,
          });
        } catch (visibilityError) {
          logger.warn(
            `[PARALLEL_COMPETITIONS] [WAIT] Season-org container not found after ${elapsed}ms - page structure may have changed`,
            {
              url: this.url,
              elapsed,
            }
          );
          return; // Fail fast - empty page or structure changed
        }
      }

      // OPTIMIZED: Shorter timeout for competition links
      // Step 2: Wait for competition links to be present (actual content)
      const elapsedBeforeLinks = Date.now() - waitStartTime;
      const remainingTimeForLinks = MAX_TOTAL_WAIT_TIME - elapsedBeforeLinks;

      if (remainingTimeForLinks <= 0) {
        logger.debug(
          `[PARALLEL_COMPETITIONS] [WAIT] Max wait time exceeded before checking links`,
          {
            url: this.url,
            elapsed: elapsedBeforeLinks,
          }
        );
        return; // Fail fast - no time to check links
      }

      try {
        const timeoutForLinks = Math.min(
          QUICK_CHECK_TIMEOUT,
          remainingTimeForLinks
        );
        await this.page.waitForSelector(
          '[data-testid^="season-org-"] ul > li > a',
          {
            timeout: timeoutForLinks,
            visible: true,
          }
        );
        logger.debug(`Competition links found`, {
          url: this.url,
          waitTime: Date.now() - waitStartTime,
        });
      } catch (linkError) {
        // Links might not exist if no competitions - this is OK
        const elapsed = Date.now() - waitStartTime;
        logger.debug(
          `[PARALLEL_COMPETITIONS] [WAIT] Competition links not found after ${elapsed}ms (might be empty page)`,
          {
            url: this.url,
            elapsed,
            error: linkError.message,
          }
        );
        // Empty pages are valid - return early
        return;
      }

      // OPTIMIZED: Faster content check with shorter timeout
      // Step 3: Wait for competition content to be fully rendered
      const elapsedBeforeContent = Date.now() - waitStartTime;
      const remainingTimeForContent =
        MAX_TOTAL_WAIT_TIME - elapsedBeforeContent;

      if (remainingTimeForContent <= 0) {
        logger.debug(
          `[PARALLEL_COMPETITIONS] [WAIT] Max wait time exceeded before content check`,
          {
            url: this.url,
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
            const competitionLinks = document.querySelectorAll(
              '[data-testid^="season-org-"] ul > li > a'
            );
            if (competitionLinks.length === 0) {
              return false;
            }
            // Check if at least one link has content
            for (const link of competitionLinks) {
              if (
                link.children.length > 0 ||
                (link.textContent && link.textContent.trim().length > 0)
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
        logger.debug(`Competition content is fully rendered`, {
          url: this.url,
          totalWaitTime: totalWait,
        });
      } catch (contentError) {
        // Content check failed - might be empty page or slow loading
        const elapsed = Date.now() - waitStartTime;
        logger.debug(
          `[PARALLEL_COMPETITIONS] [WAIT] Content check timeout after ${elapsed}ms (might be empty or still loading)`,
          {
            url: this.url,
            elapsed,
            error: contentError.message,
          }
        );
        // Don't wait longer - fail fast
      }

      const totalWait = Date.now() - waitStartTime;
      logger.debug(
        `Page load complete, competitions should be ready for extraction`,
        {
          url: this.url,
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
          `[PARALLEL_COMPETITIONS] [WAIT] Page structure issue detected after ${elapsed}ms - failing fast`,
          {
            error: error.message,
            url: this.url,
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
        `[PARALLEL_COMPETITIONS] [WAIT] Waiting for page load failed after ${elapsed}ms: ${error.message}`,
        {
          error: error.message,
          url: this.url,
          elapsed,
        }
      );
      // Minimal delay for unexpected errors - wait for page to be interactive
      await this.page
        .waitForFunction(
          () => {
            return document.readyState === "complete" && document.body !== null;
          },
          { timeout: 500 }
        )
        .catch(() => {});
    }
  }

  async extractCompetitionsData() {
    try {
      // Before extraction, verify the selector exists (with retry)
      // This handles cases where waitForPageLoad failed but content is still loading
      let seasonOrgsParent = null;
      let retries = 3;
      let retryDelay = 3000; // 3 seconds between retries

      while (!seasonOrgsParent && retries > 0) {
        try {
          seasonOrgsParent = await this.page.$('[data-testid^="season-org-"]');
          if (seasonOrgsParent) {
            logger.debug(
              `Season-org container found before extraction (attempt ${
                4 - retries
              })`
            );
            break;
          }
        } catch (checkError) {
          logger.debug(
            `Season-org container check failed, retrying... (${retries} retries left)`
          );
        }

        if (!seasonOrgsParent && retries > 1) {
          // Wait for season-org container to appear before retrying
          await this.page
            .waitForSelector('[data-testid^="season-org-"]', {
              timeout: retryDelay,
              visible: false,
            })
            .catch(() => {});
        }
        retries--;
      }

      if (!seasonOrgsParent) {
        logger.warn(
          `Season-org container not found after retries. Attempting extraction anyway.`
        );
      }

      const result = await this.page.evaluate(() => {
        const result = [];

        // Select the parent block (the entire container with all competitions)
        const seasonOrgsParent = document.querySelector(
          '[data-testid^="season-org-"]'
        );

        if (!seasonOrgsParent) {
          // Note: Cannot use logger here - this code runs in browser context
          // Logging is handled outside this evaluate block
          return [];
        }

        // Loop over the child divs within the parent block
        const seasonOrgs = Array.from(seasonOrgsParent.children);

        // Iterate over each child div (which contains an h2 and competition list)
        seasonOrgs.forEach((seasonOrg, index) => {
          // Get the competition name from the current div
          const competitionNameElement = seasonOrg.querySelector("h2");
          const competitionName = competitionNameElement
            ? competitionNameElement.textContent.trim()
            : `Unknown Competition Name ${index}`;

          // Extract competition details within the same seasonOrg
          const competitions = seasonOrg.querySelectorAll("ul > li > a");
          if (!competitions.length) {
            return; // Skip if no competitions found
          }

          // Iterate over each competition inside the current seasonOrg
          competitions.forEach((comp, compIndex) => {
            const season = comp.querySelector("span:nth-child(1)")
              ? comp.querySelector("span:nth-child(1)").textContent.trim()
              : `Unknown Season ${compIndex}`;
            const dateSpan = comp.querySelector("span:nth-child(2)");
            const [startDate, endDate] = dateSpan
              ? dateSpan.textContent.split(" — ").map((date) => date.trim())
              : ["Unknown Start Date", "Unknown End Date"];
            const status = comp.querySelector("div > span")
              ? comp.querySelector("div > span").textContent.trim()
              : "Unknown Status";
            const url = comp.href;
            // Extract competition ID correctly - handle URLs ending with /teams
            const urlParts = url.split("/");
            let competitionId = urlParts[urlParts.length - 1];
            // If the last part is "teams" or empty, use the second-to-last part
            if (competitionId === "" || competitionId === "teams") {
              competitionId = urlParts[urlParts.length - 2];
            }

            // Push the competition data into the result array
            // NOTE: We do NOT set the association field here because:
            // 1. For club accounts, we use club-to-competitions link table
            // 2. For association accounts, we use association-to-competitions link table
            // 3. Setting association field directly causes Strapi validation errors when the ID is invalid
            result.push({
              competitionName, // The correct competition name from this seasonOrg
              season,
              startDate,
              endDate,
              status,
              url,
              competitionId,
              // Removed: association: associationID - use link tables instead
            });
          });
        });

        return result;
      });

      // Log if no competitions were found (after evaluate completes)
      if (!result || result.length === 0) {
        logger.debug(
          `No season organizations found on the page. Returning empty array.`,
          {
            url: this.url,
            associationID: this.associationID,
          }
        );
      }

      return result;
    } catch (error) {
      logger.error(`Error in extractCompetitionsData: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        url: this.url,
      });
      // Return empty array instead of throwing to allow processing to continue
      // This prevents the entire job from failing due to one association's page structure
      logger.warn(
        `Returning empty array due to extraction error. Processing will continue.`
      );
      return [];
    }
  }

  // This function will be stringified and passed to evaluate, hence it needs to be fully self-contained.
  extractCompetitionData(competitionElement, associationID) {
    //("extractCompetitionData is HERE")
    const competitionName = competitionElement.textContent.trim();
    const anchorElement = competitionElement.nextElementSibling;
    if (!anchorElement)
      throw new Error("Anchor element not found for competitionElement");

    const link = anchorElement.querySelector("a");
    if (!link) throw new Error("Link not found for anchorElement");

    const seasonSpan = link.querySelector("span:nth-child(1)");
    if (!seasonSpan) throw new Error("Season span not found");

    const dateSpan = link.querySelector("span:nth-child(2)");
    if (!dateSpan) throw new Error("Date span not found");

    const statusSpan = link.querySelector("div > span");
    if (!statusSpan) throw new Error("Status span not found");

    const season = seasonSpan.textContent.trim();
    const [startDate, endDate] = dateSpan.textContent
      .split(" — ")
      .map((date) => date.trim());
    const status = statusSpan.textContent.trim();
    const url = link.href;
    // Extract competition ID correctly - handle URLs ending with /teams
    const urlParts = url.split("/");
    let competitionId = urlParts[urlParts.length - 1];
    // If the last part is "teams" or empty, use the second-to-last part
    if (competitionId === "" || competitionId === "teams") {
      competitionId = urlParts[urlParts.length - 2];
    }

    // NOTE: We do NOT set the association field here because:
    // 1. For club accounts, we use club-to-competitions link table
    // 2. For association accounts, we use association-to-competitions link table
    // 3. Setting association field directly causes Strapi validation errors when the ID is invalid
    // The associationID parameter is kept for logging/debugging purposes only
    return {
      competitionName,
      season,
      startDate,
      endDate,
      status,
      url,
      competitionId,
      // Removed: association: [associationID] - use link tables instead
    };
  }

  extractIdFromUrl(url) {
    return url.split("/").slice(-1)[0];
  }
}

module.exports = AssociationCompetitionsFetcher;
