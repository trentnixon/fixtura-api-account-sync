const logger = require("../../src/utils/logger");
const AssignCompetitions = require("../assignCenter/assignCompetitions");
const GetCompetitions = require("../scrapeCenter/Competitions/getCompetitions");
const ProcessingTracker = require("../services/processingTracker");

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
   * Never throws - always returns a result to prevent app crashes.
   */
  async process() {
    try {
      // Scrape competitions data
      const getCompetitionsObj = new GetCompetitions(
        this.dataObj.TYPEOBJ,
        this.dataObj.ACCOUNT
      );
      const scrapedCompetitions = await getCompetitionsObj.setup();

      // Validate scraped data - if empty or false, log and continue without throwing
      if (
        !scrapedCompetitions ||
        (Array.isArray(scrapedCompetitions) && scrapedCompetitions.length === 0)
      ) {
        logger.warn("No competition data scraped, continuing to next step", {
          accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        });
        this.processingTracker.errorDetected("competitions");
        return { process: false, reason: "No competition data scraped" };
      }

      // Assign scraped data
      try {
        const assignCompetitionsObj = new AssignCompetitions(
          scrapedCompetitions,
          this.dataObj
        );
        await assignCompetitionsObj.setup();
      } catch (assignError) {
        // Log assignment error but don't throw - allow processing to continue
        logger.error("Error assigning competitions, continuing to next step", {
          error: assignError,
          accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        });
        this.processingTracker.errorDetected("competitions");
        return { process: false, reason: "Error assigning competitions" };
      }

      // Indicate successful processing
      return { process: true };
    } catch (error) {
      // Log error but never throw - always return a result to prevent app crash
      this.processingTracker.errorDetected("competitions");
      logger.error(
        "An error occurred in CompetitionProcessor, continuing to next step:",
        {
          error,
          accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        }
      );

      // Return failure result instead of throwing
      return { process: false, reason: error.message || "Unknown error" };
    }
  }
}

module.exports = CompetitionProcessor;
