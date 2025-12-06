const logger = require("../../../src/utils/logger");

/**
 * TeamExtractor class handles finding and extracting team data from ladder pages
 */
class TeamExtractor {
  constructor(page) {
    this.page = page;
  }

  /**
   * Finds team links using the standard PlayHQ ladder structure
   * @returns {Promise<Array>} Array of team link elements
   */
  async findTeamLinks() {
    try {
      // Standard pattern: Teams are always in the first table within [data-testid="ladder"]
      // Structure: [data-testid="ladder"] > div > table > tbody > tr > td:nth-child(2) > a
      const links = await this.page.$$(
        '[data-testid="ladder"] table:first-of-type tbody tr td:nth-child(2) a'
      );

      logger.info(`Standard ladder selector found ${links.length} team links`);

      if (links.length === 0) {
        logger.warn(
          "No team links found with standard selector - this may indicate a page structure change"
        );
      }

      return links;
    } catch (error) {
      logger.warn("Standard selector failed:", error.message);
      return [];
    }
  }

  /**
   * Extracts team information from link elements
   * @param {Array} links - Array of team link elements
   * @param {Object} teamInfo - Competition and grade information
   * @returns {Promise<Array>} Array of team objects
   */
  async extractTeamData(links, teamInfo) {
    const teams = [];

    for (const link of links) {
      try {
        // Check if page is closed before evaluating
        if (this.page.isClosed()) {
          logger.debug("[PARALLEL_TEAMS] Page closed during team extraction, aborting");
          break;
        }

        const href = await link.evaluate((el) => el.getAttribute("href")).catch((err) => {
          const errorMsg = err.message || String(err);
          if (
            errorMsg.includes("Target closed") ||
            errorMsg.includes("Session closed") ||
            errorMsg.includes("Page closed") ||
            errorMsg.includes("Protocol error")
          ) {
            throw new Error("Page closed during evaluation"); // Re-throw as cancellation
          }
          throw err; // Re-throw other errors
        });

        const teamID = href.split("/").pop();

        // Check again before second evaluate
        if (this.page.isClosed()) {
          logger.debug("[PARALLEL_TEAMS] Page closed during team extraction, aborting");
          break;
        }

        const teamName = await link.evaluate((el) => el.innerText.trim()).catch((err) => {
          const errorMsg = err.message || String(err);
          if (
            errorMsg.includes("Target closed") ||
            errorMsg.includes("Session closed") ||
            errorMsg.includes("Page closed") ||
            errorMsg.includes("Protocol error")
          ) {
            throw new Error("Page closed during evaluation"); // Re-throw as cancellation
          }
          throw err; // Re-throw other errors
        });

        // Skip if no valid href or team name
        if (!href || !teamName || href === "#" || teamName.length < 2) {
          continue;
        }

        let teamObj = {
          teamName,
          href,
          teamID,
          competition: [teamInfo.compID],
          grades: [teamInfo.id],
          club: [], // Will be populated later
        };

        teams.push(teamObj);
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
          continue;
        }

        logger.warn(`Error processing team link:`, error.message);
        continue;
      }
    }

    logger.info(`Successfully extracted ${teams.length} teams`);
    return teams;
  }

  /**
   * Gets debugging information about links on the page
   * @returns {Promise<Object>} Link information object
   */
  async getLinkInfo() {
    try {
      const linkInfo = {
        totalLinks: 0,
        teamLinks: 0,
        teamLinksAlt: 0,
        firstTenLinks: [],
      };

      // Count total links
      try {
        const allLinks = await this.page.$$("a");
        linkInfo.totalLinks = allLinks.length;
      } catch (error) {
        logger.warn("Could not count total links:", error.message);
      }

      // Count team links
      try {
        const teamLinks = await this.page.$$('a[href*="/teams/"]');
        linkInfo.teamLinks = teamLinks.length;
      } catch (error) {
        logger.warn("Could not count team links:", error.message);
      }

      // Count alternative team links
      try {
        const teamLinksAlt = await this.page.$$('a[href*="/team/"]');
        linkInfo.teamLinksAlt = teamLinksAlt.length;
      } catch (error) {
        logger.warn("Could not count alternative team links:", error.message);
      }

      // Get first 10 links for debugging
      try {
        const allLinks = await this.page.$$("a");
        if (allLinks.length > 0) {
          linkInfo.firstTenLinks = await this.page.evaluate(() => {
            const links = document.querySelectorAll("a");
            return Array.from(links)
              .slice(0, 10)
              .map((link) => ({
                href: link.getAttribute("href"),
                text: link.innerText.trim().substring(0, 50),
                className: link.className,
              }));
          });
        }
      } catch (error) {
        logger.warn("Could not get first 10 links:", error.message);
      }

      return linkInfo;
    } catch (error) {
      logger.warn("Could not get link info:", error.message);
      return {};
    }
  }
}

module.exports = TeamExtractor;
