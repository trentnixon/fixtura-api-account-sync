const ProcessingTracker = require("../services/processingTracker");
const logger = require("../../src/utils/logger");
const TeamCRUD = require("./teams/TeamCRUD");

/**
 * Handles the assignment of team data to a database or other storage system.
 * Processes both new and existing teams.
 */
class AssignTeams {
  constructor(teams, dataObj) {
    this.teams = teams;
    this.dataObj = dataObj;
    this.teamCRUD = new TeamCRUD(dataObj);
    this.processingTracker = ProcessingTracker.getInstance();
  }

  // Processes all teams and handles errors
  async setup() {
    if (!this.validateTeamsData(this.teams)) {
      logger.error("AssignTeams setup method: Invalid teams data provided", {
        method: "setup",
        class: "AssignTeams"
      });
      return { success: false, message: "Invalid teams data provided" };
    }

    for (const team of this.teams) {
      try {
        logger.info(`Processing team: ${team.teamName}`, {
          method: "setup",
          class: "AssignTeams",
          teamID: team.teamID
        });
        await this.processTeam(team);
      } catch (error) {
        logger.error(`Error in AssignTeams setup method for team ${team.teamName}:`, {
          error, method: "setup", class: "AssignTeams"
        });
        this.processingTracker.errorDetected("teams");
        if (!this.recoverFromError(team)) {
          continue; // Skip to the next team if recovery is not possible
        }
      }
    }
    return { success: true };
  }

  validateTeamsData(teams) {
    return Array.isArray(teams) && teams.every(team => team && team.teamID);
  }

  recoverFromError(team) {
    // Implement logic for recovering from minor data inconsistencies
    // For now, just log the recovery attempt
    logger.info(`Attempting recovery for team: ${team.teamName}`, {
      method: "recoverFromError",
      class: "AssignTeams",
      teamID: team.teamID
    });
    // Return false if recovery is not possible
    return false;
  }


  // Processes an individual team
  async processTeam(team) {
    try {
      const existingTeam = await this.teamCRUD.checkIfTeamExists(team.teamID, "teams");

      if (existingTeam) {
        this.processingTracker.itemUpdated("teams");
        await this.teamCRUD.updateTeam(existingTeam[0].id, team);
      } else {
        this.processingTracker.itemNew("teams");
        await this.teamCRUD.createTeam(team);
      }
    } catch (error) {
      logger.error(`Error processing individual team ${team.teamName}:`, {
        error, method: "processTeam", class: "AssignTeams"
      });
      throw error;
    }
  }
}

module.exports = AssignTeams;

/**
 * Developer Notes:
 * - This class requires a list of teams and a data object for CRUD operations.
 * - The class uses TeamCRUD for database interactions.
 * - Error handling is comprehensive for both team processing and CRUD operations.
 *
 * Future Improvements:
 * - Implement more detailed logging for CRUD operations.
 * - Explore batch processing of teams for efficiency.
 * - Consider adding a validation layer for team data before processing.
 * - Develop a rollback mechanism for errors in batch operations.
 */
