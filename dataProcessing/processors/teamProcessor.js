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
      const grades = this.dataObj.Grades;
      // Initialize GetTeams with all grades for parallel processing
      const getTeamsObj = new GetTeamsFromLadder({
        ...this.dataObj,
        Grades: grades,
      });

      logger.info(`Processing ${grades.length} grades in parallel...`);
      const scrapedTeams = await getTeamsObj.setup();

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
