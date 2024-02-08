const CompetitionUtils = require("./competition/CompetitionUtils");
const CompetitionHandler = require("./competition/CompetitionHandler");
const CompetitionCRUD = require("./competition/CompetitionCRUD");
const logger = require("../../src/utils/logger");
const ProcessingTracker = require("../services/processingTracker");

/**
 * Processes and assigns competition data.
 * Handles both existing and new competitions.
 */
class AssignCompetitions {
  constructor(competitions, dataObj) {
    this.competitions = competitions;
    this.dataObj = dataObj;
    this.competitionUtils = new CompetitionUtils();
    this.competitionHandler = new CompetitionHandler(dataObj);
    this.competitionCRUD = new CompetitionCRUD(dataObj);
    this.processingTracker = ProcessingTracker.getInstance();
  }

  // Main setup function to process all competitions
  async setup() {
    for (const competition of this.competitions) {
      try {
        await this.processCompetition(competition);
      } catch (error) {
        logger.error(`Error processing competition ${competition.competitionName}:`, error);
      }
    }
    return { success: true };
  }

  // Processes a single competition
  async processCompetition(competition) {
    const competitionId = competition.competitionId; // Using ID directly from competition object
    const existingCompetition = await this.competitionCRUD.checkIfCompetitionExists(competitionId, "competitions");

    if (existingCompetition) {
      this.processingTracker.itemUpdated("competitions");
      await this.competitionHandler.handleExistingCompetition(competition, existingCompetition[0].id);
      
    } else {
      this.processingTracker.itemNew("competitions");
      await this.competitionHandler.handleNewCompetition(competition);
    }
  }
}

module.exports = AssignCompetitions;
