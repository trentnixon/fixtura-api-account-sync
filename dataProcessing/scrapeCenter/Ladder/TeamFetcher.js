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
   * Fetches teams by navigating to the ladder page of the team and extracting team information.
   */
  async fetchTeams() {
    const navStartTime = Date.now();
    try {
      logger.info(`[PARALLEL_TEAMS] [NAV] Navigating to ${this.teamInfo.href}/ladder`);
      await this.page.goto(`${this.teamInfo.href}/ladder`, {
        timeout: 15000, // 15 seconds - faster failure detection
        waitUntil: "domcontentloaded", // Fast - same as other scrapers
      });
      const navDuration = Date.now() - navStartTime;
      logger.info(`[PARALLEL_TEAMS] [NAV] Navigation complete: ${navDuration}ms`);
      const extractStartTime = Date.now();
      const result = await this.getTeamNamesAndUrls();
      const extractDuration = Date.now() - extractStartTime;
      logger.info(`[PARALLEL_TEAMS] [EXTRACT] Extraction complete: ${extractDuration}ms (total: ${Date.now() - navStartTime}ms)`);
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
