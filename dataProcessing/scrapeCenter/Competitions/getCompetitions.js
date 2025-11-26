const logger = require("../../../src/utils/logger");
const PuppeteerManager = require("../../puppeteer/PuppeteerManager");
const AssociationCompetitionsFetcher = require("./AssociationCompetitionsFetcher");
const CRUDOperations = require("../../services/CRUDoperations");
const ProcessingTracker = require("../../services/processingTracker");
const { error } = require("winston");

/**
 * Handles scraping of competition data from websites.
 * Supports different modes for clubs and associations.
 */
class GetCompetitions {
  constructor(TYPEOBJ, ACCOUNT, ProcessTracker) {
    this.AccountID = TYPEOBJ.TYPEID;
    this.URL = TYPEOBJ.TYPEURL;
    this.ACCOUNTTYPE = ACCOUNT.ACCOUNTTYPE;
    this.processingTracker = ProcessingTracker.getInstance();
    // Use singleton to share browser instance across services (memory optimization)
    this.puppeteerManager = PuppeteerManager.getInstance();
    this.CRUDOperations = new CRUDOperations();
  }

  // Initialize Puppeteer and create a new page
  async initPage() {
    return await this.puppeteerManager.createPageInNewContext();
  }

  // Fetch competitions for associations
  async fetchAssociationCompetitions(page, url, associationID) {
    const fetcher = new AssociationCompetitionsFetcher(
      page,
      url,
      associationID
    );
    return fetcher.fetchCompetitions();
  }

  // Process club competitions
  async processClubCompetitions(page) {
    let competitions = [];
    const associationData = await this.CRUDOperations.fetchDataForClub(
      this.AccountID
    );

    for (const association of associationData.attributes.associations.data) {
      try {
        const comp = await this.fetchAssociationCompetitions(
          page,
          association.attributes.href,
          association.id
        );
        competitions = [...competitions, ...comp];
      } catch (error) {
        logger.error(
          `Error fetching competitions for association: ${association.attributes.href}`,
          { error, method: "processClubCompetitions" }
        );
      }
    }
    return competitions;
  }

  // Main method to setup competition scraping
  async setup() {
    try {
      const page = await this.initPage();
      let competitions = [];

      if (this.ACCOUNTTYPE === "ASSOCIATION") {
        competitions = await this.fetchAssociationCompetitions(
          page,
          this.URL,
          this.AccountID
        );
      } else {
        competitions = await this.processClubCompetitions(page);
      }

      if (competitions.length === 0) {
        //throw new Error("No competitions found");
        logger.info("No competitions found");
      }

      this.processingTracker.itemFound("competitions", competitions.length);
      return competitions;
    } catch (error) {
      logger.error("Error in GetCompetitions setup method", {
        error,
        method: "setup",
      });
      throw error;
    } finally {
      await this.puppeteerManager.dispose();
    }
  }
}

module.exports = GetCompetitions;
