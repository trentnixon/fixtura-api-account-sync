const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");
const qs = require("qs");

class UpdateOrCreateTeams {
    async setup(teams) {
        let allSucceeded = true;
    
        for (const team of teams) {
          try {
            const isExisting = await this.checkIfTeamExists(team, "teams");
    
            if (isExisting.length === 0) {
              const result = await this.processTeams("POST", "teams", team);
              allSucceeded = allSucceeded && result.success;
              logger.info(`Creating team ${team.teamName}`);
            } else {
              logger.info("Team already exists", isExisting[0].id);
              const result = await this.processTeams("PUT", `teams/${isExisting[0].id}`, team);
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
          grade: {
            id: { $eq: team.grade[0] },
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
      console.error(`Error checking for Team ${team.teamName}:`, error);
      return false;
    }
  }

  async processTeams(method, url, team) {
    try {
      await fetcher(url, method, { data: team });
      return {
        success: true,
      };
    } catch (error) {
      console.error(`Error ${method === "POST" ? "storing" : "updating"} team:`, error);
      return {
        success: false,
      };
    }
  }
}

module.exports = UpdateOrCreateTeams;
