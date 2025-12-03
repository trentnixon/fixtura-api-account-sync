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

      // ========================================
      // [DEBUG] LOG SCRAPED DATA BEFORE SENDING TO CMS
      // ========================================
      logger.info("[COMPETITIONS] ===== SCRAPED DATA BEFORE CMS =====", {
        accountId: this.dataObj.ACCOUNT.ACCOUNTID,
        scrapedCount: scrapedCompetitions ? scrapedCompetitions.length : 0,
        isArray: Array.isArray(scrapedCompetitions),
        dataType: scrapedCompetitions
          ? typeof scrapedCompetitions
          : "null/undefined",
      });

      if (scrapedCompetitions && Array.isArray(scrapedCompetitions)) {
        logger.info(
          `[COMPETITIONS] ===== SCRAPED ${scrapedCompetitions.length} COMPETITIONS =====`
        );

        // Log each competition individually for better visibility
        scrapedCompetitions.forEach((comp, index) => {
          const compData = {
            competitionName: comp?.competitionName || "N/A",
            season: comp?.season || "N/A",
            startDate: comp?.startDate || "N/A",
            endDate: comp?.endDate || "N/A",
            status: comp?.status || "N/A",
            url: comp?.url || "N/A",
            competitionId: comp?.competitionId || "N/A",
            association: comp?.association || "N/A",
          };

          logger.info(
            `[COMPETITIONS] Competition ${index + 1}/${
              scrapedCompetitions.length
            }: ${compData.competitionName} (ID: ${compData.competitionId})`
          );
          logger.info(
            `[COMPETITIONS]   Season: ${compData.season}, Status: ${compData.status}`
          );
          logger.info(
            `[COMPETITIONS]   Dates: ${compData.startDate} - ${compData.endDate}`
          );
          logger.info(`[COMPETITIONS]   URL: ${compData.url}`);
          logger.info(`[COMPETITIONS]   Association: ${compData.association}`);
          logger.info(`[COMPETITIONS]   Full Data:`, compData);
        });

        // Also log summary
        logger.info(
          `[COMPETITIONS] Summary: ${scrapedCompetitions.length} competitions scraped`,
          {
            totalCompetitions: scrapedCompetitions.length,
            competitionNames: scrapedCompetitions.map(
              (c) => c?.competitionName || "Unknown"
            ),
            competitionIds: scrapedCompetitions.map(
              (c) => c?.competitionId || "Unknown"
            ),
          }
        );

        // Track competitions found
        this.processingTracker.itemFound(
          "competitions",
          scrapedCompetitions.length
        );
        logger.info(
          `[COMPETITIONS] Tracked ${scrapedCompetitions.length} competitions in processing tracker`
        );
      } else {
        logger.warn("[COMPETITIONS] Scraped data is not an array:", {
          data: scrapedCompetitions,
          type: typeof scrapedCompetitions,
        });
      }
      logger.info("[COMPETITIONS] ===== END SCRAPED DATA LOG =====");

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
