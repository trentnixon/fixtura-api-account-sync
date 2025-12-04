const logger = require("../../src/utils/logger");
const AssignTeamsToCompsAndGrades = require("../assignCenter/assignTeamsToComps");
const GetTeamsFromLadder = require("../scrapeCenter/Ladder/getTeamsFromLadder");
const ProcessingTracker = require("../services/processingTracker");

/**
 * TeamProcessor class handles the overall process of fetching and assigning team data.
 * It orchestrates the workflow of scraping team data and assigning it to Strapi.
 */
class TeamProcessor {
  constructor(dataObj) {
    this.dataObj = dataObj;
    this.processingTracker = ProcessingTracker.getInstance();
  }

  /**
   * Main processing method for team data.
   * It scrapes the team data and assigns it using respective classes.
   * Throws an error if any step in the process fails.
   */
  async process() {
    try {
      // MEMORY TRACKING: Log memory before starting
      const MemoryTracker = require("../utils/memoryTracker");
      const memoryTracker = MemoryTracker.getInstance();
      if (memoryTracker) {
        const beforeStats = memoryTracker.logMemoryStats("[TEAMS] BEFORE START");
        logger.info(`[TEAMS] Memory before start: RSS=${beforeStats.rss.toFixed(2)} MB, Heap=${beforeStats.heapUsed.toFixed(2)} MB`);
      }

      const grades = this.dataObj.Grades;
      logger.info(`[TEAMS] Processing ${grades.length} grades, Grades array size: ${JSON.stringify(grades).length} bytes`);

      // MEMORY FIX: Only pass minimal dataObj fields needed, not full object
      // GetTeamsFromLadder only uses: ACCOUNT, Grades, and TEAMS (optional)
      const getTeamsObj = new GetTeamsFromLadder({
        ACCOUNT: this.dataObj.ACCOUNT, // Only account info needed
        Grades: grades, // Grades array
        TEAMS: this.dataObj.TEAMS, // Optional - only if needed
        // Don't pass: COMPETITIONS, DETAILS, TYPEOBJ (not needed for teams scraping)
      });

      // MEMORY TRACKING: Log memory after creating GetTeamsFromLadder
      if (memoryTracker) {
        const afterCreateStats = memoryTracker.logMemoryStats("[TEAMS] AFTER CREATE");
        logger.info(`[TEAMS] Memory after creating GetTeamsFromLadder: RSS=${afterCreateStats.rss.toFixed(2)} MB, Heap=${afterCreateStats.heapUsed.toFixed(2)} MB`);
      }

      logger.info(`Processing ${grades.length} grades in parallel...`);
      const scrapedTeams = await getTeamsObj.setup();

      // MEMORY TRACKING: Log memory after scraping
      if (memoryTracker) {
        const afterScrapeStats = memoryTracker.logMemoryStats("[TEAMS] AFTER SCRAPE");
        logger.info(`[TEAMS] Memory after scraping: RSS=${afterScrapeStats.rss.toFixed(2)} MB, Heap=${afterScrapeStats.heapUsed.toFixed(2)} MB, Teams scraped: ${scrapedTeams?.length || 0}`);
      }

      // ========================================
      // [DEBUG] LOG SCRAPED DATA BEFORE SENDING TO CMS
      // ========================================
      logger.info("[TEAMS] ===== SCRAPED DATA BEFORE CMS =====", {
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        scrapedCount: scrapedTeams ? scrapedTeams.length : 0,
        isArray: Array.isArray(scrapedTeams),
        dataType: scrapedTeams ? typeof scrapedTeams : "null/undefined",
      });

      if (scrapedTeams && Array.isArray(scrapedTeams)) {
        logger.info(`[TEAMS] ===== SCRAPED ${scrapedTeams.length} TEAMS =====`);

        // Log each team individually for better visibility (limit to first 10 for readability)
        const teamsToLog = scrapedTeams.slice(0, 10);
        teamsToLog.forEach((team, index) => {
          const teamData = {
            teamName: team?.teamName || "N/A",
            teamID: team?.teamID || "N/A",
            href: team?.href || "N/A",
            competition: team?.competition || [],
            grades: team?.grades || [],
            club: team?.club || [],
          };

          logger.info(
            `[TEAMS] Team ${index + 1}/${teamsToLog.length}: ${
              teamData.teamName
            } (TeamID: ${teamData.teamID})`
          );
          logger.info(
            `[TEAMS]   Competition: ${
              teamData.competition.join(", ") || "N/A"
            }, Grades: ${teamData.grades.join(", ") || "N/A"}`
          );
          logger.info(
            `[TEAMS]   Club: ${teamData.club.join(", ") || "None"}, URL: ${
              teamData.href
            }`
          );
        });

        if (scrapedTeams.length > 10) {
          logger.info(`[TEAMS] ... and ${scrapedTeams.length - 10} more teams`);
        }

        // Also log summary
        const uniqueGrades = [
          ...new Set(scrapedTeams.flatMap((t) => t?.grades || [])),
        ];
        const uniqueCompetitions = [
          ...new Set(scrapedTeams.flatMap((t) => t?.competition || [])),
        ];
        const uniqueClubs = [
          ...new Set(scrapedTeams.flatMap((t) => t?.club || [])),
        ];

        logger.info(`[TEAMS] Summary: ${scrapedTeams.length} teams scraped`, {
          totalTeams: scrapedTeams.length,
          uniqueGrades: uniqueGrades.length,
          uniqueCompetitions: uniqueCompetitions.length,
          uniqueClubs: uniqueClubs.length,
        });

        // Track teams found
        this.processingTracker.itemFound("teams", scrapedTeams.length);
        logger.info(
          `[TEAMS] Tracked ${scrapedTeams.length} teams in processing tracker`
        );
      } else {
        logger.warn("[TEAMS] Scraped data is not an array:", {
          data: scrapedTeams,
          type: typeof scrapedTeams,
        });
      }
      logger.info("[TEAMS] ===== END SCRAPED DATA LOG =====");

      if (!scrapedTeams || scrapedTeams.length === 0) {
        logger.warn(`No team data scraped for any grades.`);
        this.processingTracker.errorDetected("teams");
        return { process: true };
      }

      // Assign the scraped team data
      const assignTeamsObj = new AssignTeamsToCompsAndGrades(
        scrapedTeams,
        this.dataObj
      );
      await assignTeamsObj.setup();

      return { process: true };
    } catch (error) {
      this.processingTracker.errorDetected("teams");
      logger.error("Error in TeamProcessor process method", {
        error,
        method: "process",
        class: "TeamProcessor",
      });
      throw error;
    } finally {
      // MEMORY FIX: Clear dataObj reference after processing to free large arrays
      // This allows GC to free TEAMS, Grades, COMPETITIONS arrays
      this.dataObj = null;
    }
  }

  /* async process() {
    try {
      // Scrape team data
      const getTeamsObj = new GetTeamsFromLadder(this.dataObj);
      const scrapedTeams = await getTeamsObj.setup();

      if (!scrapedTeams) {
        logger.warn(`No team data scraped.`);
        this.processingTracker.errorDetected("teams");
        //throw new Error("No team data scraped.");
      }
      // Assign scraped data
      const assignTeamsObj = new AssignTeamsToCompsAndGrades(
        scrapedTeams,
        this.dataObj
      );
      await assignTeamsObj.setup();

      return { process: true };
    } catch (error) {
      this.processingTracker.errorDetected("teams");
      logger.error("Error in TeamProcessor process method", {
        error,
        method: "process",
        class: "TeamProcessor",
      });
      //throw error;
    }
  } */
}

module.exports = TeamProcessor;

/**
 * Developer Notes:
 * - Ensure the dataObj passed to TeamProcessor contains the necessary information for team processing.
 * - This class relies on GetTeamsFromLadder and AssignTeamsToCompsAndGrades for specific operations.
 * - ProcessingTracker is used for tracking and logging purposes.
 *
 * Future Improvements:
 * - Consider adding more granular error handling for different steps in the process method.
 * - Explore optimization opportunities for the scraping and assigning processes.
 * - Investigate the use of more efficient data structures for handling large datasets.
 * - Add functionality for retry mechanisms in case of network or scraping failures.
 */
