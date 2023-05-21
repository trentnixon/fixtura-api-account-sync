/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const fetcher = require("../Utils/fetcher");
const logger = require("../Utils/logger");
const qs = require("qs");

class assignGameData {
  async setup(filteredArray) {
    for (const game of filteredArray) {
    
      if (!game.teamHomeID) {
        logger.warn(`Games.teamHomeID was Undefined ${game.teamHomeID}`);
        continue;
      } 

      const existingGameId = await this.checkIfGameExists(
        game.gameID,
        "game-meta-datas"
      );

      const [homeTeamID, awayTeamID] = await this.getTeamsIds([
        game.teamHomeID,
        game.teamAwayID,
      ]);
      homeTeamID && game.teams.push(homeTeamID);
      awayTeamID && game.teams.push(awayTeamID);

      if (existingGameId) {
        await this.updateGameData(existingGameId, game);
      } else {
        await this.storeGameData(game);
      }
    }

    return {
      success: true,
    };
  }

  async checkIfGameExists(gameID, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          gameID: {
            $eq: gameID,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length === 0 ? false : response[0].id;
    } catch (error) {
      logger.error(`Error checking for competition ${gameID}:`, error);
      return false;
    }
  }

  async getTeamsIds(teamIDs) {
    const query = qs.stringify(
      {
        filters: {
          teamID: {
            $in: teamIDs,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );
    try {
      const response = await fetcher(`teams?${query}`);
      return response.length === 0
        ? [false, false]
        : [response[0].id, response[1].id];
    } catch (error) {
      logger.error(`Error checking teamIDs ${teamIDs}:`, error);
      return [false, false];
    }
  }

  async storeGameData(game) {
    logger.info(`Storing game ${game.gameID}`);
    try {
      await fetcher("game-meta-datas", "POST", { data: game });
    } catch (error) {
      logger.error(`Error storing game ${game.gameID}:`, error);
    }
  }

  async updateGameData(gameId, game) {
    logger.info(`Game ${game.gameID} is already stored. Updating it.`);
    try {
      await fetcher(`game-meta-datas/${gameId}`, "PUT", { data: game });
    } catch (error) {
      logger.error(`Error updating game ${game.gameID}:`, error);
    }
  }
}

module.exports = assignGameData;
