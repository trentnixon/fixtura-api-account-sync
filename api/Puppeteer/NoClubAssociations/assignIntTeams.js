/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");
const qs = require("qs");

class UpdateOrCreateTeams {
  async setup(teams) {
    let allSucceeded = true;

    for (const team of teams) {
      try {
        const existingTeams = await this.checkIfTeamExists(team, "teams");

        if (existingTeams.length === 0) {
          const result = await this.createTeam(team);
          allSucceeded = allSucceeded && result.success;
          logger.info(`Creating team ${team.teamName}`);
        } else {
          logger.info("Team already exists", existingTeams[0].id);
          const result = await this.updateTeam(existingTeams[0].id, team);
          allSucceeded = allSucceeded && result.success;
          logger.info(`Updating team ${team.teamName}`);
        }
      } catch (error) {
        logger.error(`Error processing team ${team.teamName}:`, error);
        allSucceeded = false;
      }
    }

    return { success: allSucceeded };
  }

  async checkIfTeamExists(team, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          grades: {
            id: { $eq: team.grades },
          },
          competition: {
            id: { $eq: team.competition[0] },
          },
          teamName: {
            $eq: team.teamName,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response;
    } catch (error) {
      logger.error(`Error checking for Team ${team.teamName}:`, error);
      throw error;
    }
  }

  async createTeam(team) {
    try {
      await fetcher("teams", "POST", { data: team });
      return { success: true };
    } catch (error) {
      logger.error(`Error storing team:`, error);
      return { success: false };
    }
  }

  async updateTeam(teamId, team) {
    try {
      await fetcher(`teams/${teamId}`, "PUT", { data: team });
      return { success: true };
    } catch (error) {
      logger.error(`Error updating team:`, error);
      return { success: false };
    }
  }
}

module.exports = UpdateOrCreateTeams;
