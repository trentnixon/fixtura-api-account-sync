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
    //console.log("this.dataObj.DETAILS")
    //console.log(this.dataObj.DETAILS.Sport)
    const sportType = this.dataObj.DETAILS.Sport;
    return this.endpoints[sportType] || "game-meta-datas"; // Default to 'game-meta-datas' if not specified
  }

  async checkIfGameExists(gameID) {
    const endpoint = this.getSportType();
    const query = qs.stringify(
      { filters: { gameID: { $eq: gameID } } },
      { encodeValuesOnly: true }
    );

    try {
      const response = await fetcher(`${endpoint}?${query}`);

      // Handle null response from fetcher (connection issues, etc.)
      if (!response) {
        logger.warn(
          `Fetcher returned null for ${endpoint}, likely due to connection issues`,
          {
            method: "checkIfGameExists",
            class: "GameCRUD",
            gameID: gameID,
            endpoint: endpoint,
          }
        );
        return null;
      }

      // Handle both array and single object responses
      if (Array.isArray(response)) {
        if (response.length === 0) {
          logger.info(
            `No existing game found for gameID ${gameID} - this is a new game`,
            {
              method: "checkIfGameExists",
              class: "GameCRUD",
              gameID: gameID,
              endpoint: endpoint,
            }
          );
          return false; // Return false to indicate game doesn't exist (should be created)
        }
        logger.info(
          `Found existing game for gameID ${gameID}: ${response[0].id}`,
          {
            method: "checkIfGameExists",
            class: "GameCRUD",
            gameID: gameID,
            existingId: response[0].id,
          }
        );
        return response[0];
      } else if (response && typeof response === "object") {
        // Check if it's a Strapi response object with data property
        if (response.data) {
          if (Array.isArray(response.data)) {
            return response.data.length > 0 ? response.data[0] : false;
          } else if (response.data.gameID === gameID) {
            return response.data;
          }
        }

        // Single object response - check if it has the expected gameID
        if (response.gameID === gameID) {
          return response;
        } else {
          logger.warn(
            `Response object gameID mismatch: expected ${gameID}, got ${response.gameID}`,
            {
              method: "checkIfGameExists",
              class: "GameCRUD",
              gameID: gameID,
              endpoint: endpoint,
            }
          );
          return false; // Return false instead of null for new games
        }
      } else {
        logger.warn(
          `Unexpected response format from ${endpoint}: ${typeof response}`,
          {
            method: "checkIfGameExists",
            class: "GameCRUD",
            gameID: gameID,
            endpoint: endpoint,
            responseType: typeof response,
          }
        );
        return null; // Only return null for actual errors
      }
    } catch (error) {
      logger.error(`Error checking if game exists in ${endpoint}: ${error}`, {
        method: "checkIfGameExists",
        class: "GameCRUD",
      });
      throw error;
    }
  }

  async createGame(game) {
    const endpoint = this.getSportType();
    try {
      logger.info(`Attempting to create game in ${endpoint}: ${game.gameID}`, {
        method: "createGame",
        class: "GameCRUD",
        gameID: game.gameID,
        endpoint: endpoint,
      });

      const response = await fetcher(`${endpoint}`, "POST", { data: game });
      logger.info(`Game created in ${endpoint}: ${response.id}`, {
        method: "createGame",
        class: "GameCRUD",
        gameID: game.gameID,
        createdId: response.id,
      });
      return response;
    } catch (error) {
      logger.error(`Error creating game in ${endpoint}: ${error}`, {
        method: "createGame",
        class: "GameCRUD",
        gameID: game.gameID,
        endpoint: endpoint,
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
    const query = qs.stringify(
      {
        filters: {
          teamID: { $in: teamIDs },
        },
      },
      { encodeValuesOnly: true }
    );

    try {
      const response = await fetcher(`teams?${query}`);

      // Handle null response from fetcher (connection issues, etc.)
      if (!response) {
        logger.warn(
          `Fetcher returned null for teams query, likely due to connection issues`,
          {
            method: "getTeamsIds",
            class: "GameCRUD",
            teamIDs: teamIDs,
          }
        );
        return [false, false];
      }

      // Ensure response is an array before checking length
      if (!Array.isArray(response)) {
        logger.warn(
          `Unexpected response format from teams endpoint: ${typeof response}`,
          {
            method: "getTeamsIds",
            class: "GameCRUD",
            teamIDs: teamIDs,
            responseType: typeof response,
          }
        );
        return [false, false];
      }

      if (response.length === 0) {
        return [false, false];
      }
      return response.map((team) => team.id);
    } catch (error) {
      logger.error(`Error checking teamIDs ${teamIDs}:`, error);
      return [false, false];
    }
  }
  // Implement any additional CRUD methods needed for game operations
}

module.exports = GameCRUD;
