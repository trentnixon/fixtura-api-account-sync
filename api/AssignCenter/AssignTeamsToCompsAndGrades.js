/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */
const fetcher = require("../Utils/fetcher");  
const logger = require("../Utils/logger");
const qs = require("qs");

class AssignTeamsToCompsAndGrades {
  async setup(teams) {
    logger.info(`Processing ${teams?.length} Teams`);
    let allSucceeded = true;

    for (const team of teams) {
      try {
        const existingTeam = await this.findExistingTeam(team);
        allSucceeded = allSucceeded && await this.processTeam(existingTeam, team);
      } catch (error) {
        this.handleProcessingError(error, team);
        allSucceeded = false;
      }
    }
    return { success: allSucceeded };
  }

  async findExistingTeam(team) {
    const existingTeams = await this.checkIfTeamExists(team, "teams");
    return existingTeams.length > 0 ? existingTeams[0] : null;
  }

  async processTeam(existingTeam, newTeamData) {
    if (!existingTeam) {
      return await this.handleNewTeam(newTeamData);
    }
    return await this.handleExistingTeam(existingTeam, newTeamData);
  }

  async handleNewTeam(team) {
    const result = await this.createTeam(team);
    logger.info(`Creating team ${team.teamName}`);
    return result.success;
  }

  async handleExistingTeam(existingTeam, newTeamData) {
    if (existingTeam.attributes.teamName !== newTeamData.teamName) {
      logger.info(`Team name has changed from ${existingTeam.attributes.teamName} to ${newTeamData.teamName}`);
    } else {
      logger.info(`${newTeamData.teamName} already exists`);
    }
    const result = await this.updateTeam(existingTeam.id, newTeamData);
    logger.info(`Updating team ${newTeamData.teamName}`);
    return result.success;
  }

  handleProcessingError(error, team) {
    logger.error(`Error processing team ${team.teamName}:`, error);
    logger.critical("An error occurred in AssignTeamsToCompsAndGrades", {
      file: "AssignTeamsToCompsAndGrades.js",
      function: "AssignTeamsToCompsAndGrades",
      error: error,
    });
  }

  async checkIfTeamExists(team, resourcePath) {
    const query = qs.stringify({
      filters: { teamID: team.teamID },
    }, { encodeValuesOnly: true });
    
    try {
      return await fetcher(`${resourcePath}?${query}`);
    } catch (error) {
      this.handleCheckError(error, team);
      throw error;
    }
  }

  handleCheckError(error, team) {
    logger.error(`Error checking for Team ${team.teamName}:`, error);
    logger.critical("An error occurred in checkIfTeamExists", {
      file: "AssignTeamsToCompsAndGrades.js",
      function: "checkIfTeamExists",
      error: error,
    });
  }

  async createTeam(team) {
    try {
      await fetcher("teams", "POST", { data: team });
      return { success: true };
    } catch (error) {
      this.handleCreateError(error);
      return { success: false };
    }
  }

  handleCreateError(error) {
    logger.error(`Error storing team:`, error);
    logger.critical("An error occurred in createTeam", {
      file: "AssignTeamsToCompsAndGrades.js",
      function: "createTeam",
      error: error,
    });
  }

  async updateTeam(teamId, team) {
    try {
      await fetcher(`teams/${teamId}`, "PUT", { data: team });
      return { success: true };
    } catch (error) {
      this.handleUpdateError(error);
      return { success: false };
    }
  }

  handleUpdateError(error) {
    logger.error(`Error updating team:`, error);
    logger.critical("An error occurred in updateTeam", {
      file: "AssignTeamsToCompsAndGrades.js",
      function: "updateTeam",
      error: error,
    });
  }
}

module.exports = AssignTeamsToCompsAndGrades;
