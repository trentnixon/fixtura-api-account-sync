const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");
const qs = require("qs");

class GameCRUD {
  constructor(dataObj) {
    this.dataObj = dataObj;
    this.endpoints = {
      Cricket: "game-meta-datas",
      Hockey: "game-data-hockeys",
      AFL: "game-data-afls",
      Netball: "game-data-netballs",
      Basketball: "game-data-basketballs",
    };
  }

  getSportType() {
    // Retrieve the sport type from dataObj and return the corresponding endpoint
    console.log("this.dataObj.DETAILS")
    console.log(this.dataObj.DETAILS.Sport)
    const sportType = this.dataObj.DETAILS.Sport;
    return this.endpoints[sportType] || 'game-meta-datas'; // Default to 'game-meta-datas' if not specified
  }

  async checkIfGameExists(gameID) {
    const endpoint = this.getSportType();
    const query = qs.stringify({ filters: { gameID: { $eq: gameID } } }, { encodeValuesOnly: true });

    try {
      const response = await fetcher(`${endpoint}?${query}`);
      return response.length > 0 ? response[0] : null;
    } catch (error) {
      logger.error(`Error checking if game exists in ${endpoint}: ${error}`, {
        method: "checkIfGameExists", class: "GameCRUD",
      });
      throw error;
    }
  }

  async createGame(game) {
    const endpoint = this.getSportType();
    try {
      const response = await fetcher(`${endpoint}`, "POST", { data: game });
      logger.info(`Game created in ${endpoint}: ${response.id}`, {
        method: "createGame",
        class: "GameCRUD",
      });
      return response;
    } catch (error) {
      logger.error(`Error creating game in ${endpoint}: ${error}`, {
        method: "createGame",
        class: "GameCRUD",
      });
      throw error;
    }
  }

  async updateGame(gameId, game) {
    const endpoint = this.getSportType();
    try {
      await fetcher(`${endpoint}/${gameId}`, "PUT", { data: game });
      logger.info(`Game updated in ${endpoint}: ${gameId}`, {
        method: "updateGame",
        class: "GameCRUD",
      });
    } catch (error) {
      logger.error(`Error updating game in ${endpoint}: ${error}`, {
        method: "updateGame",
        class: "GameCRUD",
      });
      throw error;
    }
  }

  async getTeamsIds(teamIDs) {
    const query = qs.stringify({
      filters: {
        teamID: { $in: teamIDs },
      },
    }, { encodeValuesOnly: true });

    try {
      const response = await fetcher(`teams?${query}`);
      if (response.length === 0) {
        return [false, false];
      }
      return response.map(team => team.id);
    } catch (error) {
      logger.error(`Error checking teamIDs ${teamIDs}:`, error);
      return [false, false];
    }
  }
  // Implement any additional CRUD methods needed for game operations
}

module.exports = GameCRUD;
