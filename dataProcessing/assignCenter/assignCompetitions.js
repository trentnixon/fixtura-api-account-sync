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
        // Enhanced error logging with full details
        console.error(`[AssignCompetitions] ERROR processing competition ${competition.competitionName}:`);
        console.error(`Error Message:`, error.message);
        console.error(`Error Stack:`, error.stack);
        console.error(`Competition Object:`, JSON.stringify(competition, null, 2));
        console.error(`Full Error:`, error);

        logger.error(
          `Error processing competition ${competition.competitionName}: ${error.message}`
        );
        logger.error("Error in AssignCompetitions processCompetition", {
          error: error.message,
          errorName: error.name,
          stack: error.stack,
          competition: competition?.name || competition?.id,
          competitionName: competition?.competitionName,
          competitionId: competition?.competitionId,
          fullError: error.toString(),
        });
      }
    }
    return { success: true };
  }

  // Processes a single competition
  async processCompetition(competition) {
    // DEBUG: Log competition object at entry point - use console.log for visibility
    console.log(`[AssignCompetitions] processCompetition - DEBUG START`);
    console.log(`Competition Name:`, competition.competitionName);
    console.log(`Competition ID:`, competition.competitionId);
    console.log(`Competition Keys:`, Object.keys(competition));
    console.log(`Has association field:`, 'association' in competition);
    console.log(`Association value:`, competition.association);
    console.log(`Account Type:`, this.dataObj.ACCOUNT.ACCOUNTTYPE);
    console.log(`TYPEOBJ:`, JSON.stringify(this.dataObj.TYPEOBJ, null, 2));
    console.log(`Full Competition Object:`, JSON.stringify(competition, null, 2));

    logger.info(`[AssignCompetitions] processCompetition - DEBUG START`, {
      competitionName: competition.competitionName,
      competitionId: competition.competitionId,
      competitionKeys: Object.keys(competition),
      competitionAssociation: competition.association,
      hasAssociationField: 'association' in competition,
      accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
      dataObjTYPEOBJ: this.dataObj.TYPEOBJ,
      typeObjTypeId: this.dataObj.TYPEOBJ?.TYPEID,
      fullCompetitionObject: JSON.stringify(competition, null, 2),
    });

    const competitionId = competition.competitionId; // Using ID directly from competition object
    const existingCompetition =
      await this.competitionCRUD.checkIfCompetitionExists(
        competitionId,
        "competitions"
      );

    // DEBUG: Log existing competition check result
    console.log(`[AssignCompetitions] processCompetition - Existing check result`);
    console.log(`Competition ID:`, competitionId);
    console.log(`Exists:`, !!existingCompetition);
    console.log(`Existing Competition:`, existingCompetition);
    console.log(`Existing Competition ID:`, existingCompetition?.[0]?.id);

    logger.info(`[AssignCompetitions] processCompetition - Existing check result`, {
      competitionId: competitionId,
      exists: !!existingCompetition,
      existingCompetitionId: existingCompetition?.[0]?.id,
      existingCompetitionData: existingCompetition ? JSON.stringify(existingCompetition[0], null, 2) : null,
    });

    //console.log("[processCompetition]", competition);
    if (existingCompetition) {
      console.log(`[AssignCompetitions] Competition exists, calling handleExistingCompetition`);
      this.processingTracker.itemUpdated("competitions");
      await this.competitionHandler.handleExistingCompetition(
        competition,
        existingCompetition[0].id
      );
    } else {
      console.log(`[AssignCompetitions] Competition is new, calling handleNewCompetition`);
      this.processingTracker.itemNew("competitions");
      await this.competitionHandler.handleNewCompetition(competition);
    }
  }
}

module.exports = AssignCompetitions;
