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
      // Scrape team data
      const getTeamsObj = new GetTeamsFromLadder(this.dataObj);
      const scrapedTeams = await getTeamsObj.setup();

      if (!scrapedTeams) {
        logger.warn(`No team data scraped.`);
        this.processingTracker.errorDetected("teams");
        //throw new Error("No team data scraped.");
      }

      //console.log("[scrapedTeams]", scrapedTeams);
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
  }
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
