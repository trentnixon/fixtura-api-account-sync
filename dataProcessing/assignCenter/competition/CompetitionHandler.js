const CompetitionCRUD = require("./CompetitionCRUD");
const logger = require("../../../src/utils/logger");

/**
 * Handles the processing of competitions based on their existence and account type.
 * Delegates CRUD operations to the CompetitionCRUD class.
 */
class CompetitionHandler {
  constructor(dataObj) {
    this.dataObj = dataObj;
    this.competitionCRUD = new CompetitionCRUD(dataObj);
  }

  // Handles existing competitions based on account type
  async handleExistingCompetition(competition, existingCompetitionId) {
    try {
      if (this.dataObj.ACCOUNT.ACCOUNTTYPE === "CLUB") {
        await this.competitionCRUD.updateClubCompetition(competition, existingCompetitionId);
      } else {
        await this.competitionCRUD.updateAssociationCompetition(competition, existingCompetitionId);
      }
    } catch (error) {
      logger.error(`[CompetitionHandler] handleExistingCompetition - ERROR`, {
        existingCompetitionId: existingCompetitionId,
        competitionName: competition.competitionName,
        accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw new Error(`Error handling existing competition: ${error.message}`);
    }
  }

  // Handles new competitions based on account type
  async handleNewCompetition(competition) {
    try {
      const newCompetitionId = await this.competitionCRUD.createCompetitionEntry(competition);

      if (this.dataObj.ACCOUNT.ACCOUNTTYPE === "CLUB") {
        await this.competitionCRUD.updateClubCompetition(competition, newCompetitionId);
      } else {
        await this.competitionCRUD.updateAssociationCompetition(competition, newCompetitionId);
      }
    } catch (error) {
      logger.error(`[CompetitionHandler] handleNewCompetition - ERROR`, {
        competitionName: competition.competitionName,
        accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw new Error(`Error handling new competition: ${error.message}`);
    }
  }
}

module.exports = CompetitionHandler;
