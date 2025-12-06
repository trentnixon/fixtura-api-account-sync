const logger = require("../../../src/utils/logger");
const CRUDOperations = require("../../services/CRUDoperations");
const LadderDetector = require("./LadderDetector");
const TeamExtractor = require("./TeamExtractor");
const PageAnalyzer = require("./PageAnalyzer");
const PageStructureMonitor = require("./PageStructureMonitor");

/**
 * TeamFetcher class is responsible for fetching team data from a given URL.
 * It navigates to the team ladder page and extracts team information.
 */
class TeamFetcher {
  constructor(page, teamInfo) {
    this.page = page;
    this.teamInfo = teamInfo; // Contains URL and additional data like competition ID and grade ID
    this.CRUDOperations = new CRUDOperations();

    // Initialize modules
    this.ladderDetector = new LadderDetector(page);
    this.teamExtractor = new TeamExtractor(page);
    this.pageAnalyzer = new PageAnalyzer(page);
    this.structureMonitor = new PageStructureMonitor(page);

    // Track if we've established a baseline for this session
    this.baselineEstablished = false;
  }

  /**
   * Optimizes page for ladder scraping by blocking non-essential resources
   * This reduces proxy load and speeds up page loading
   */
  async optimizePageForLadder() {
    try {
      // Check if request interception is already enabled
      // If it is, remove existing listeners to avoid "Request is already handled" errors
      const hasInterception = this.page.listenerCount("request") > 0;

      if (hasInterception) {
        // Request interception already set up - remove existing listeners to avoid conflicts
        this.page.removeAllListeners("request");
      }

      // Block images, stylesheets, fonts, media - we only need HTML structure
      // This significantly reduces proxy load and speeds up page load
      await this.page.setRequestInterception(true);
      this.page.on("request", (request) => {
        try {
          const resourceType = request.resourceType();
          const url = request.url();

          // Block non-essential resources to speed up proxy loading
          // NOTE: stylesheets are NOT blocked - needed for proper page rendering (especially SPAs)
          if (
            resourceType === "image" ||
            // resourceType === "stylesheet" || // REMOVED: CSS needed for proper rendering
            resourceType === "font" ||
            resourceType === "media" ||
            resourceType === "websocket" ||
            resourceType === "manifest" ||
            url.includes("analytics") ||
            url.includes("tracking") ||
            url.includes("collect")
          ) {
            request.abort().catch(() => {
              // Suppress "Request is already handled" errors - happens when page is reset during interception
            });
          } else {
            request.continue().catch(() => {
              // Suppress "Request is already handled" errors - happens when page is reset during interception
            });
          }
        } catch (error) {
          // Suppress "Request is already handled" errors
          const errorMsg = error.message || String(error);
          if (!errorMsg.includes("Request is already handled")) {
            logger.debug(
              `[PARALLEL_TEAMS] Request interception error: ${errorMsg}`
            );
          }
        }
      });
      logger.debug(
        "[PARALLEL_TEAMS] Page optimized for ladder scraping (blocked images/stylesheets)"
      );
    } catch (error) {
      const errorMsg = error.message || String(error);
      if (errorMsg.includes("Request is already handled")) {
        logger.debug(
          "[PARALLEL_TEAMS] Request interception conflict (expected during page reuse)"
        );
      } else {
        logger.debug(
          `[PARALLEL_TEAMS] Request interception setup error: ${errorMsg}`
        );
      }
    }
  }

  /**
   * Fetches teams by navigating to the ladder page of the team and extracting team information.
   */
  async fetchTeams() {
    const navStartTime = Date.now();
    try {
      // Optimize page for ladder scraping before navigation
      await this.optimizePageForLadder();

      // CRITICAL: Check page state before navigation
      if (this.page.isClosed()) {
        logger.warn("[PARALLEL_TEAMS] Page closed before navigation, aborting");
        return [];
      }

      // CRITICAL: Small delay to ensure any page reset operations complete
      // This prevents race conditions where page reset and navigation happen simultaneously
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check again after delay
      if (this.page.isClosed()) {
        logger.warn("[PARALLEL_TEAMS] Page closed after delay, aborting");
        return [];
      }

      logger.info(
        `[PARALLEL_TEAMS] [NAV] Navigating to ${this.teamInfo.href}/ladder`
      );

      try {
        await this.page
          .goto(`${this.teamInfo.href}/ladder`, {
            timeout: 45000, // Increased to 45 seconds for proxy latency
            waitUntil: "networkidle2", // Wait for network to be mostly idle (max 2 connections) - ensures dynamic content loads
          })
          .catch((navErr) => {
            // Handle navigation cancellation errors immediately
            const errorMsg = navErr.message || String(navErr);
            if (
              errorMsg.includes("Target closed") ||
              errorMsg.includes("Session closed") ||
              errorMsg.includes("Page closed") ||
              errorMsg.includes("Protocol error") ||
              errorMsg.includes("Navigation interrupted")
            ) {
              throw new Error("Page closed during navigation"); // Re-throw as cancellation
            }
            throw navErr; // Re-throw other errors
          });
      } catch (navError) {
        // Check if it's a cancellation error
        const errorMsg = navError.message || String(navError);
        if (
          errorMsg.includes("Page closed during navigation") ||
          errorMsg.includes("Target closed") ||
          errorMsg.includes("Session closed")
        ) {
          logger.debug("[PARALLEL_TEAMS] Navigation cancelled (page reset)");
          return [];
        }

        // If networkidle2 times out, try with load as fallback
        logger.warn(
          `[PARALLEL_TEAMS] [NAV] networkidle2 timeout, trying load fallback`
        );
        try {
          if (this.page.isClosed()) {
            logger.warn(
              "[PARALLEL_TEAMS] Page closed before fallback navigation"
            );
            return [];
          }

          await this.page
            .goto(`${this.teamInfo.href}/ladder`, {
              timeout: 45000,
              waitUntil: "load",
            })
            .catch((loadErr) => {
              const errorMsg = loadErr.message || String(loadErr);
              if (
                errorMsg.includes("Target closed") ||
                errorMsg.includes("Session closed") ||
                errorMsg.includes("Page closed") ||
                errorMsg.includes("Protocol error") ||
                errorMsg.includes("Navigation interrupted")
              ) {
                throw new Error("Page closed during navigation");
              }
              throw loadErr;
            });
        } catch (loadError) {
          const errorMsg = loadError.message || String(loadError);
          if (
            errorMsg.includes("Page closed during navigation") ||
            errorMsg.includes("Target closed") ||
            errorMsg.includes("Session closed")
          ) {
            logger.debug(
              "[PARALLEL_TEAMS] Fallback navigation cancelled (page reset)"
            );
            return [];
          }

          // Last resort: domcontentloaded
          logger.warn(
            `[PARALLEL_TEAMS] [NAV] Load timeout, trying domcontentloaded fallback`
          );
          if (this.page.isClosed()) {
            logger.warn(
              "[PARALLEL_TEAMS] Page closed before final fallback navigation"
            );
            return [];
          }

          await this.page
            .goto(`${this.teamInfo.href}/ladder`, {
              timeout: 45000,
              waitUntil: "domcontentloaded",
            })
            .catch((finalErr) => {
              const errorMsg = finalErr.message || String(finalErr);
              if (
                errorMsg.includes("Target closed") ||
                errorMsg.includes("Session closed") ||
                errorMsg.includes("Page closed") ||
                errorMsg.includes("Protocol error") ||
                errorMsg.includes("Navigation interrupted")
              ) {
                throw new Error("Page closed during navigation");
              }
              throw finalErr;
            });
        }
      }
      const navDuration = Date.now() - navStartTime;
      logger.info(
        `[PARALLEL_TEAMS] [NAV] Navigation complete: ${navDuration}ms`
      );

      // Wait for dynamic content to load (especially important with proxy latency)
      // PlayHQ uses React/SPA, so content loads after initial page load
      // Wait for ladder container to start appearing (indicates React has rendered)
      // Properly handle page closure errors
      try {
        if (this.page.isClosed()) {
          logger.warn("[PARALLEL_TEAMS] Page closed before wait, aborting");
          return [];
        }
        await this.page
          .waitForSelector('[data-testid="ladder"]', {
            timeout: 5000,
            visible: false, // Just check if element exists in DOM, not necessarily visible yet
          })
          .catch((err) => {
            // Check if error is due to page closure
            const errorMsg = err.message || String(err);
            if (
              errorMsg.includes("Target closed") ||
              errorMsg.includes("Session closed") ||
              errorMsg.includes("Page closed") ||
              errorMsg.includes("Protocol error")
            ) {
              logger.debug(
                "[PARALLEL_TEAMS] Page closed during waitForSelector"
              );
              return; // Suppress cancellation errors
            }
            // Re-throw other errors
            throw err;
          });
      } catch (err) {
        // Handle any remaining errors
        const errorMsg = err.message || String(err);
        if (
          !errorMsg.includes("Target closed") &&
          !errorMsg.includes("Session closed") &&
          !errorMsg.includes("Page closed")
        ) {
          logger.debug(`[PARALLEL_TEAMS] Wait error: ${errorMsg}`);
        }
      }

      const extractStartTime = Date.now();
      const result = await this.getTeamNamesAndUrls();
      const extractDuration = Date.now() - extractStartTime;
      logger.info(
        `[PARALLEL_TEAMS] [EXTRACT] Extraction complete: ${extractDuration}ms (total: ${
          Date.now() - navStartTime
        }ms)`
      );

      return result;
    } catch (error) {
      logger.error(
        `Error in TeamFetcher.fetchTeams for URL: ${this.teamInfo.href}`,
        { error, method: "fetchTeams" }
      );
      throw error;
    }
  }

  /**
   * Extracts team names and URLs from the page.
   */
  async getTeamNamesAndUrls() {
    try {
      await this.monitorPageStructure();

      const hasNoLadder = await this.ladderDetector.hasNoLadder();
      if (hasNoLadder) {
        return [];
      }

      const tableFound = await this.ladderDetector.waitForLadderTable();

      // Page analysis should happen AFTER table is loaded
      const pageAnalysis = await this.pageAnalyzer.analyzePage();
      this.pageAnalyzer.logAnalysis(pageAnalysis);

      const teamLinks = await this.teamExtractor.findTeamLinks();

      if (teamLinks.length === 0) {
        logger.warn("No team links found with any selector");
        return [];
      }

      const teams = await this.teamExtractor.extractTeamData(
        teamLinks,
        this.teamInfo
      );

      const teamsWithClubs = await this.addClubInfoToTeams(teams);

      return teamsWithClubs;
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
        `Error in TeamFetcher.getTeamNamesAndUrls: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Monitors page structure for changes and alerts when investigation is needed
   */
  async monitorPageStructure() {
    try {
      // Establish baseline on first run
      if (!this.baselineEstablished) {
        logger.info("Establishing page structure baseline...");
        await this.structureMonitor.establishBaseline();
        this.baselineEstablished = true;
        logger.info("Page structure baseline established successfully");
      } else {
        // Check for structure changes
        logger.info("Checking for page structure changes...");
        const changeAnalysis =
          await this.structureMonitor.detectStructureChanges();

        if (changeAnalysis.hasChanges) {
          logger.error(
            "🚨 PAGE STRUCTURE CHANGES DETECTED - INVESTIGATION REQUIRED 🚨"
          );
          logger.error(
            "The page structure has changed since the baseline was established."
          );
          logger.error("This may indicate PlayHQ has updated their website.");
          logger.error("Please investigate and update selectors if necessary.");

          // Get current structure health
          const health = await this.structureMonitor.getStructureHealth();
          logger.info(`Current structure health: ${health.overall}`);
          if (health.recommendations.length > 0) {
            health.recommendations.forEach((rec) =>
              logger.info(`Recommendation: ${rec}`)
            );
          }
        } else {
          logger.info("✅ Page structure is stable - no changes detected");
        }
      }
    } catch (error) {
      logger.warn("Could not monitor page structure:", error.message);
    }
  }

  /**
   * Logs performance statistics for the backoff strategy
   */
  logPerformanceStats() {
    try {
      this.ladderDetector.logPerformanceStats();
    } catch (error) {
      logger.warn("Could not log performance stats:", error.message);
    }
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    try {
      this.ladderDetector.resetPerformanceMetrics();
    } catch (error) {
      logger.warn("Could not reset performance metrics:", error.message);
    }
  }

  /**
   * Adds club information to team objects
   * @param {Array} teams - Array of team objects
   * @returns {Promise<Array>} Teams with club information
   */
  async addClubInfoToTeams(teams) {
    const teamsWithClubs = [];

    for (const team of teams) {
      try {
        const clubID = await this.getClubIDFromHref(team.href);
        team.club = clubID ? [clubID] : [];
        teamsWithClubs.push(team);
      } catch (error) {
        logger.warn(
          `Error adding club info for team ${team.teamName}:`,
          error.message
        );
        team.club = [];
        teamsWithClubs.push(team);
      }
    }

    return teamsWithClubs;
  }

  /**
   * Extracts the club ID from the team's href attribute.
   */
  async getClubIDFromHref(href) {
    const playHQId = this.extractPlayHQId(href);

    try {
      return await this.CRUDOperations.fetchClubIdByPlayHQId(playHQId);
    } catch (error) {
      logger.error(`Error fetching club ID for PlayHQID: ${playHQId}`, {
        error: error.message,
        stack: error.stack,
        playHQId,
      });
      return null;
    }
  }

  // UTILS FUNCS
  extractPlayHQId(href) {
    const splitUrl = href.split("/");
    return splitUrl.length >= 5 ? splitUrl[4] : null;
  }
}

module.exports = TeamFetcher;

// Developer Notes:
// - The class now uses modular components for better separation of concerns
// - LadderDetector handles ladder detection and table waiting
// - TeamExtractor handles finding and extracting team data
// - PageAnalyzer handles debugging and page analysis
// - Main class focuses on orchestration and business logic
