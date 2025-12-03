const logger = require("../../../src/utils/logger");

class AssociationCompetitionsFetcher {
  constructor(page, url, associationID) {
    this.page = page;
    this.url = url;
    this.associationID = associationID;
  }

  async fetchCompetitions() {
    try {
      logger.info(
        `[AssociationCompetitionsFetcher] Starting fetchCompetitions - URL: ${this.url}, Association ID: ${this.associationID}`
      );
      logger.debug(
        `Checking competitions in fetchCompetitionInAssociation on URL: ${this.url} and this ID ${this.associationID}`
      );

      logger.info(`[AssociationCompetitionsFetcher] Navigating to URL...`);
      await this.navigateToUrl();
      logger.info(`[AssociationCompetitionsFetcher] Navigation complete, waiting for page load...`);

      await this.waitForPageLoad();
      logger.info(`[AssociationCompetitionsFetcher] Page loaded, extracting competitions data...`);

      const competitions = await this.extractCompetitionsData();
      logger.info(`[AssociationCompetitionsFetcher] Extracted ${competitions ? competitions.length : 0} competitions`, {
        competitionsCount: competitions ? competitions.length : 0,
        competitions: competitions,
      });

      return competitions;
    } catch (error) {
      logger.error(`[AssociationCompetitionsFetcher] Error in fetching competitions for association`, {
        error: error.message,
        errorName: error.name,
        url: this.url,
        associationID: this.associationID,
        stack: error.stack,
        pageExists: !!this.page,
        pageClosed: this.page ? this.page.isClosed() : null,
        pageUrl: this.page ? this.page.url() : null,
      });
      throw error;
    }
  }

  async navigateToUrl() {
    await this.page.goto(this.url, {
      timeout: 15000, // 15 seconds - faster failure detection
      waitUntil: "domcontentloaded", // Fast - same as other scrapers
    });
  }

  async waitForPageLoad() {
    try {
      // Step 1: Wait for the season-org container to exist in DOM first
      // Don't require visible immediately - element might exist but not be visible yet
      await this.page.waitForSelector('[data-testid^="season-org-"]', {
        timeout: 10000, // Increased timeout for slower pages
        visible: false, // First check if element exists in DOM
      });
      logger.debug(`Season-org container found in DOM`, { url: this.url });

      // Step 1b: Then wait for it to become visible (if needed)
      // This gives the page more time to render
      try {
        await this.page.waitForSelector('[data-testid^="season-org-"]', {
          timeout: 5000,
          visible: true, // Now check if it's visible
        });
        logger.debug(`Season-org container is now visible`, { url: this.url });
      } catch (visibilityError) {
        // Element exists but not visible yet - that's okay, continue anyway
        logger.debug(`Season-org container exists but not yet visible, continuing...`, {
          url: this.url,
          error: visibilityError.message,
        });
      }

      // Step 2: Wait for competition links to be present (actual content)
      try {
        await this.page.waitForSelector(
          '[data-testid^="season-org-"] ul > li > a',
          {
            timeout: 8000,
            visible: true,
          }
        );
        logger.debug(`Competition links found`, { url: this.url });
      } catch (linkError) {
        // Links might not exist if no competitions, but log it
        logger.debug(
          `Competition links not found (might be empty page)`,
          {
            url: this.url,
            error: linkError.message,
          }
        );
        // Don't throw - empty pages are valid
      }

      // Step 3: Wait for competition content to be fully rendered
      // Check that competition links have actual content (not just empty links)
      try {
        await this.page.waitForFunction(
          () => {
            const competitionLinks = document.querySelectorAll(
              '[data-testid^="season-org-"] ul > li > a'
            );
            if (competitionLinks.length === 0) {
              return false; // No links yet
            }
            // Check if at least one link has content (has spans or text)
            for (const link of competitionLinks) {
              if (
                link.children.length > 0 ||
                (link.textContent && link.textContent.trim().length > 0)
              ) {
                return true; // At least one link has content
              }
            }
            return false; // Links exist but no content yet
          },
          {
            timeout: 10000, // Wait up to 10 seconds for content to render
            polling: 200, // Check every 200ms
          }
        );
        logger.debug(`Competition content is fully rendered`, { url: this.url });
      } catch (contentError) {
        // Content check failed - might be empty page or slow loading
        logger.debug(
          `Content check timeout (might be empty or still loading)`,
          {
            url: this.url,
            error: contentError.message,
          }
        );
        // Add delay to give content more time to load
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      logger.debug(`Page load complete, competitions should be ready for extraction`, {
        url: this.url,
      });
    } catch (error) {
      // Log error but never throw - allow processing to continue
      logger.error(
        `Waiting for page load failed: ${error.message}. This could be due to the page structure changing. Continuing anyway.`,
        { error: error.message, url: this.url }
      );
      // Add a longer delay even on error to give content more time to load
      // Try waiting for the selector with a longer timeout as a fallback
      try {
        logger.debug(`Attempting fallback wait for season-org container...`);
        await this.page.waitForSelector('[data-testid^="season-org-"]', {
          timeout: 15000, // Longer timeout for slow pages
          visible: false, // Don't require visible, just in DOM
        });
        logger.debug(`Fallback wait succeeded - season-org container found`);
      } catch (fallbackError) {
        logger.warn(
          `Fallback wait also failed: ${fallbackError.message}. Adding extra delay before extraction.`,
          { url: this.url }
        );
        // Add extra delay before extraction
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
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
            logger.debug(`Season-org container found before extraction (attempt ${4 - retries})`);
            break;
          }
        } catch (checkError) {
          logger.debug(`Season-org container check failed, retrying... (${retries} retries left)`);
        }

        if (!seasonOrgsParent && retries > 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
        retries--;
      }

      if (!seasonOrgsParent) {
        logger.warn(`Season-org container not found after retries. Attempting extraction anyway.`);
      }

      return await this.page.evaluate((associationID) => {
        const result = [];

        // Select the parent block (the entire container with all competitions)
        const seasonOrgsParent = document.querySelector(
          '[data-testid^="season-org-"]'
        );

        if (!seasonOrgsParent) {
          logger.warn("No season organizations found on the page. Returning empty array.");
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
      }, this.associationID);
    } catch (error) {
      logger.error(`Error in extractCompetitionsData: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        url: this.url,
      });
      // Return empty array instead of throwing to allow processing to continue
      // This prevents the entire job from failing due to one association's page structure
      logger.warn(`Returning empty array due to extraction error. Processing will continue.`);
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
