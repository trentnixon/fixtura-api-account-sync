const logger = require("../../src/utils/logger");
const AssignCompetitions = require("../assignCenter/assignCompetitions");
const GetCompetitions = require("../scrapeCenter/Competitions/getCompetitions");
const ProcessingTracker = require("../services/ProcessingTracker");

/**
 * The CompetitionProcessor class is responsible for processing competition data.
 * It follows two main steps:
 * 1. Scraping competition data from given URLs.
 * 2. Assigning the scraped data to Strapi and the appropriate associations and clubs.
 */
class CompetitionProcessor {
  constructor(dataObj) {
    this.dataObj = dataObj;
    this.processingTracker = ProcessingTracker.getInstance();
  }

  /**
   * Main process method. 
   * Handles the workflow of scraping competition data and then assigning it.
   * Throws an error if any step in the process fails.
   */
  async process() {
    try {
      // Scrape competitions data
      const getCompetitionsObj = new GetCompetitions(
        this.dataObj.TYPEOBJ,
        this.dataObj.ACCOUNT
      );
      const scrapedCompetitions = await getCompetitionsObj.setup();

      // Validate scraped data
      if (!scrapedCompetitions) {
        throw new Error("No competition data scraped.");
      }

      // Assign scraped data
      const assignCompetitionsObj = new AssignCompetitions(
        scrapedCompetitions,
        this.dataObj
      );
      await assignCompetitionsObj.setup();

      // Indicate successful processing
      return { process: true };
    } catch (error) {
      // Log and rethrow the error for higher-level handling
      this.processingTracker.errorDetected("competitions");
      logger.error("An error occurred in CompetitionProcessor:", { error });
      
      throw error;
    }
  }
}

module.exports = CompetitionProcessor;
