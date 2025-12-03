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

  /**
   * Fetches fixtures for a batch of team IDs (internal method)
   * Only returns fixtures from the specified date onwards up to 14 days in the future
   * @param {Array<number>} teamIdsBatch - Batch of team database IDs
   * @param {string} endpoint - API endpoint
   * @param {Date} fromDate - Only fetch fixtures from this date onwards (default: today)
   * @returns {Promise<Array>} Array of fixture objects
   */
  async getFixturesForTeamsBatch(teamIdsBatch, endpoint, fromDate = null) {
    try {
      // Set fromDate to today at midnight if not provided
      if (!fromDate) {
        fromDate = new Date();
        fromDate.setHours(0, 0, 0, 0); // Start of today
      }

      // Format date as ISO string for Strapi query
      const fromDateISO = fromDate.toISOString();

      // Calculate end date (14 days from today)
      const toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 14); // Add 14 days
      toDate.setHours(23, 59, 59, 999); // End of day
      const toDateISO = toDate.toISOString();

      const query = qs.stringify(
        {
          filters: {
            $and: [
              {
                teams: {
                  id: { $in: teamIdsBatch },
                },
              },
              {
                dayOne: {
                  $gte: fromDateISO,
                  $lte: toDateISO, // Only fixtures within 14 days of today
                },
              },
            ],
          },
          populate: ["teams"],
        },
        { encodeValuesOnly: true }
      );

      const response = await fetcher(`${endpoint}?${query}`);

      if (!response) {
        logger.warn(
          `Fetcher returned null for ${endpoint} fixtures query batch`,
          {
            method: "getFixturesForTeamsBatch",
            class: "GameCRUD",
            teamIdsCount: teamIdsBatch.length,
          }
        );
        return [];
      }

      return Array.isArray(response) ? response : response.data || [];
    } catch (error) {
      logger.error(`Error fetching fixtures for team batch: ${error}`, {
        method: "getFixturesForTeamsBatch",
        class: "GameCRUD",
        teamIdsCount: teamIdsBatch.length,
      });
      // Don't throw - return empty array to allow other batches to continue
      return [];
    }
  }

  /**
   * Fetches all fixtures for given team IDs (batched to avoid URL length limits)
   * Only returns fixtures from today onwards up to 14 days in the future
   * @param {Array<number>} teamIds - Array of team database IDs
   * @param {number} batchSize - Number of team IDs per batch (default: 10)
   * @param {Date} fromDate - Only fetch fixtures from this date onwards (default: today)
   * @returns {Promise<Array>} Array of fixture objects (deduplicated)
   */
  async getFixturesForTeams(teamIds, batchSize = 10, fromDate = null) {
    const endpoint = this.getSportType();
    if (!teamIds || teamIds.length === 0) {
      logger.warn("No team IDs provided for getFixturesForTeams");
      return [];
    }

    // Set fromDate to today at midnight if not provided
    if (!fromDate) {
      fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0); // Start of today
    }

    try {
      // If we have a small number of teams, fetch directly without batching
      if (teamIds.length <= batchSize) {
        const fixtures = await this.getFixturesForTeamsBatch(
          teamIds,
          endpoint,
          fromDate
        );
        logger.info(
          `Found ${fixtures.length} fixtures (from today onwards, up to 14 days) for ${teamIds.length} teams`,
          {
            method: "getFixturesForTeams",
            class: "GameCRUD",
            teamIdsCount: teamIds.length,
            fixtureCount: fixtures.length,
            fromDate: fromDate.toISOString(),
            toDate: new Date(
              fromDate.getTime() + 14 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }
        );
        return fixtures;
      }

      // Batch the team IDs to avoid URL length limits
      const batches = [];
      for (let i = 0; i < teamIds.length; i += batchSize) {
        batches.push(teamIds.slice(i, i + batchSize));
      }

      // Calculate date range for logging (14 days from fromDate)
      const toDateForLogging = new Date(fromDate);
      toDateForLogging.setDate(toDateForLogging.getDate() + 14);

      logger.info(
        `Fetching fixtures for ${teamIds.length} teams in ${
          batches.length
        } batches (${batchSize} teams per batch, date range: ${fromDate.toISOString()} to ${toDateForLogging.toISOString()})`,
        {
          method: "getFixturesForTeams",
          class: "GameCRUD",
          totalTeams: teamIds.length,
          batchCount: batches.length,
          batchSize: batchSize,
          fromDate: fromDate.toISOString(),
          toDate: toDateForLogging.toISOString(),
        }
      );

      // Fetch fixtures for each batch
      const allFixtures = [];
      const fixtureMap = new Map(); // Use Map to deduplicate by fixture ID

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        logger.info(
          `Fetching batch ${batchIndex + 1}/${batches.length} (${
            batch.length
          } teams)`
        );

        const batchFixtures = await this.getFixturesForTeamsBatch(
          batch,
          endpoint,
          fromDate
        );

        // Deduplicate fixtures by their ID
        batchFixtures.forEach((fixture) => {
          const fixtureId = fixture.id || fixture.attributes?.id;
          if (fixtureId && !fixtureMap.has(fixtureId)) {
            fixtureMap.set(fixtureId, fixture);
            allFixtures.push(fixture);
          }
        });

        logger.info(
          `Batch ${batchIndex + 1} complete: ${
            batchFixtures.length
          } fixtures (${allFixtures.length} total unique)`
        );

        // Small delay between batches to avoid overwhelming the API
        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      logger.info(
        `Found ${allFixtures.length} unique fixtures (from today onwards, up to 14 days) for ${teamIds.length} teams`,
        {
          method: "getFixturesForTeams",
          class: "GameCRUD",
          teamIdsCount: teamIds.length,
          fixtureCount: allFixtures.length,
          batches: batches.length,
          fromDate: fromDate.toISOString(),
          toDate: toDateForLogging.toISOString(),
        }
      );

      return allFixtures;
    } catch (error) {
      logger.error(`Error fetching fixtures for teams: ${error}`, {
        method: "getFixturesForTeams",
        class: "GameCRUD",
        teamIdsCount: teamIds?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Fetches fixtures for validation using the new lightweight endpoint
   * Returns only id, gameID, urlToScoreCard with pagination support
   * @param {Array<number>} teamIds - Array of team database IDs
   * @param {Date} fromDate - Start date (default: today)
   * @param {Date} toDate - End date (default: today + 14 days)
   * @param {number} page - Page number (default: 1)
   * @param {number} pageSize - Items per page (default: 100, max: 1000)
   * @returns {Promise<{data: Array, meta: Object}>} Paginated fixture data
   */
  async getFixturesForValidation(
    teamIds,
    fromDate = null,
    toDate = null,
    page = 1,
    pageSize = 100
  ) {
    if (!teamIds || teamIds.length === 0) {
      logger.warn("No team IDs provided for getFixturesForValidation");
      return {
        data: [],
        meta: {
          pagination: { page: 1, pageSize, pageCount: 0, total: 0 },
          filters: {
            teamIds: [],
            fromDate: null,
            toDate: null,
            sportType: null,
          },
        },
      };
    }

    // Set fromDate to today at midnight if not provided
    if (!fromDate) {
      fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
    }

    // Set toDate to today + 14 days if not provided
    if (!toDate) {
      toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 14);
      toDate.setHours(23, 59, 59, 999);
    }

    // Get sport type
    const sportType = this.dataObj.DETAILS.Sport;

    try {
      // Build query string for new validation endpoint
      // Note: Use 'teamIds' as key (not 'teamIds[]') and let qs.stringify add brackets
      const queryParams = {
        teamIds: teamIds, // Array will be formatted as teamIds[]=1&teamIds[]=2
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        sportType: sportType,
        page: page,
        pageSize: Math.min(pageSize, 1000), // Max 1000 per page
      };

      const query = qs.stringify(queryParams, {
        encodeValuesOnly: true,
        arrayFormat: "brackets", // Converts teamIds array to teamIds[]=1&teamIds[]=2
      });

      // Note: baseUrl is http://127.0.0.1:1337, so we need /api prefix for Strapi endpoints
      // But check if baseUrl already includes /api - if so, don't add it again
      // Strapi endpoints require /api prefix
      // Based on error URL showing http://127.0.0.1:1337/api//api/fixtures/validation
      // The baseUrl must be http://127.0.0.1:1337/api (includes /api)
      // So path should be /fixtures/validation (without /api prefix)
      const endpointPath = `fixtures/validation?${query}`;

      // DEBUG: Log request details
      logger.info(`[VALIDATION-ENDPOINT] Fetching from validation endpoint`, {
        method: "getFixturesForValidation",
        endpoint: endpointPath,
        teamIdsCount: teamIds.length,
        teamIds: teamIds.slice(0, 5), // Log first 5 team IDs
        page,
        pageSize,
        sportType,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      });

      // NOTE: fetcher returns res.data, not the full { data, meta } object
      // So we need to fetch the full response differently
      // For now, let's use fetcher and see what we get
      const response = await fetcher(endpointPath);

      // DEBUG: Log full response structure
      // Note: fetcher returns res.data, so response might be an array directly
      logger.info(`[VALIDATION-ENDPOINT] Raw response received`, {
        method: "getFixturesForValidation",
        responseType: typeof response,
        isArray: Array.isArray(response),
        isNull: response === null,
        isUndefined: response === undefined,
        responseLength: Array.isArray(response) ? response.length : "N/A",
        firstItem:
          Array.isArray(response) && response.length > 0 ? response[0] : null,
        responseKeys:
          response && typeof response === "object" && !Array.isArray(response)
            ? Object.keys(response)
            : [],
        fullResponse: JSON.stringify(response, null, 2).substring(0, 2000),
      });

      // DEBUG: Log sample data if available
      if (Array.isArray(response) && response.length > 0) {
        logger.info(`[VALIDATION-ENDPOINT] Sample fixture data (first item):`, {
          method: "getFixturesForValidation",
          sampleFixture: response[0],
          fixtureKeys: Object.keys(response[0]),
          hasId: response[0].id !== undefined,
          hasGameID: response[0].gameID !== undefined,
          hasUrlToScoreCard: response[0].urlToScoreCard !== undefined,
        });
      } else if (
        response &&
        typeof response === "object" &&
        !Array.isArray(response)
      ) {
        // Response might be { data: [...], meta: {...} }
        logger.info(`[VALIDATION-ENDPOINT] Response is object (not array):`, {
          method: "getFixturesForValidation",
          keys: Object.keys(response),
          hasData: response.data !== undefined,
          hasMeta: response.meta !== undefined,
          dataLength: Array.isArray(response.data)
            ? response.data.length
            : "N/A",
          sampleData:
            Array.isArray(response.data) && response.data.length > 0
              ? response.data[0]
              : null,
        });
      }

      if (!response) {
        logger.warn(
          `[VALIDATION-ENDPOINT] Fetcher returned null for validation endpoint`,
          {
            method: "getFixturesForValidation",
            class: "GameCRUD",
            teamIdsCount: teamIds.length,
            page,
            pageSize,
          }
        );
        return {
          data: [],
          meta: {
            pagination: { page, pageSize, pageCount: 0, total: 0 },
            filters: {
              teamIds,
              fromDate: fromDate.toISOString(),
              toDate: toDate.toISOString(),
              sportType,
            },
          },
        };
      }

      // NOTE: fetcher returns res.data, so response is likely just the data array
      // If response is an array, that's the fixtures data
      // If response is an object with data/meta, use that structure
      let parsedData = [];
      let parsedMeta = {
        pagination: {
          page: page,
          pageSize: pageSize,
          pageCount: 0,
          total: 0,
        },
        filters: {
          teamIds,
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          sportType,
        },
      };

      if (Array.isArray(response)) {
        // fetcher returned just the data array (res.data)
        parsedData = response;
        // We don't have meta info from fetcher, so estimate pagination
        parsedMeta.pagination.total = response.length;
        parsedMeta.pagination.pageCount = Math.ceil(response.length / pageSize);
        logger.info(
          `[VALIDATION-ENDPOINT] Response is array (fetcher returned res.data only)`,
          {
            method: "getFixturesForValidation",
            dataCount: parsedData.length,
            note: "Meta information not available - fetcher only returns res.data",
          }
        );
      } else if (response && typeof response === "object" && response.data) {
        // Response has { data, meta } structure (unlikely with current fetcher)
        parsedData = Array.isArray(response.data) ? response.data : [];
        parsedMeta = response.meta || parsedMeta;
        logger.info(`[VALIDATION-ENDPOINT] Response has data/meta structure`, {
          method: "getFixturesForValidation",
          dataCount: parsedData.length,
          pagination: parsedMeta.pagination,
        });
      } else {
        logger.warn(`[VALIDATION-ENDPOINT] Unexpected response format`, {
          method: "getFixturesForValidation",
          responseType: typeof response,
          response: response,
        });
      }

      // DEBUG: Log parsed result
      logger.info(`[VALIDATION-ENDPOINT] Parsed result:`, {
        method: "getFixturesForValidation",
        dataCount: parsedData.length,
        pagination: parsedMeta.pagination,
        totalFixtures: parsedMeta.pagination.total,
        pageCount: parsedMeta.pagination.pageCount,
      });

      return {
        data: parsedData,
        meta: parsedMeta,
      };
    } catch (error) {
      logger.error(`Error fetching fixtures for validation: ${error}`, {
        method: "getFixturesForValidation",
        class: "GameCRUD",
        teamIdsCount: teamIds?.length || 0,
        page,
        pageSize,
      });
      throw error;
    }
  }

  /**
   * Fetches all fixtures for an account
   * @param {number} accountId - Account database ID
   * @returns {Promise<Array>} Array of fixture objects
   */
  async getFixturesForAccount(accountId) {
    const endpoint = this.getSportType();
    if (!accountId) {
      logger.warn("No account ID provided for getFixturesForAccount");
      return [];
    }

    try {
      // Note: This assumes fixtures are linked to teams, which are linked to accounts
      // You may need to adjust this query based on your actual data structure
      const query = qs.stringify(
        {
          filters: {
            teams: {
              club: {
                account: { id: { $eq: accountId } },
              },
            },
          },
          populate: ["teams"],
        },
        { encodeValuesOnly: true }
      );

      const response = await fetcher(`${endpoint}?${query}`);

      if (!response) {
        logger.warn(
          `Fetcher returned null for ${endpoint} fixtures query for account ${accountId}`,
          {
            method: "getFixturesForAccount",
            class: "GameCRUD",
            accountId: accountId,
          }
        );
        return [];
      }

      const fixtures = Array.isArray(response) ? response : response.data || [];
      logger.info(
        `Found ${fixtures.length} fixtures for account ${accountId}`,
        {
          method: "getFixturesForAccount",
          class: "GameCRUD",
          accountId: accountId,
          fixtureCount: fixtures.length,
        }
      );

      return fixtures;
    } catch (error) {
      logger.error(`Error fetching fixtures for account: ${error}`, {
        method: "getFixturesForAccount",
        class: "GameCRUD",
        accountId: accountId,
      });
      throw error;
    }
  }

  /**
   * Deletes a fixture (hard delete)
   * @param {number} fixtureId - Database ID of the fixture to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteGame(fixtureId) {
    const endpoint = this.getSportType();
    try {
      logger.warn(
        `[HARD DELETE] Attempting to PERMANENTLY delete fixture ${fixtureId} from ${endpoint} - This action cannot be undone`,
        {
          method: "deleteGame",
          class: "GameCRUD",
          fixtureId: fixtureId,
          endpoint: endpoint,
          mode: "hard",
          warning: "PERMANENT DELETION - DATA CANNOT BE RECOVERED",
        }
      );

      const result = await fetcher(`${endpoint}/${fixtureId}`, "DELETE");
      logger.info(
        `[HARD DELETE] ✅ Fixture PERMANENTLY deleted from ${endpoint}: ${fixtureId}`,
        {
          method: "deleteGame",
          class: "GameCRUD",
          fixtureId: fixtureId,
          endpoint: endpoint,
          result: result,
        }
      );
      return { deleted: true, fixtureId, mode: "hard", permanent: true };
    } catch (error) {
      logger.error(
        `[HARD DELETE] ❌ Error deleting fixture from ${endpoint}: ${error}`,
        {
          method: "deleteGame",
          class: "GameCRUD",
          fixtureId: fixtureId,
          endpoint: endpoint,
          error: error.message,
          stack: error.stack,
        }
      );
      throw error;
    }
  }

  /**
   * Soft deletes a fixture (marks as deleted)
   * @param {number} fixtureId - Database ID of the fixture to soft delete
   * @param {string} reason - Reason for deletion
   * @returns {Promise<Object>} Deletion result
   */
  async softDeleteGame(fixtureId, reason) {
    const endpoint = this.getSportType();
    try {
      logger.info(
        `Attempting to soft delete fixture ${fixtureId} from ${endpoint}`,
        {
          method: "softDeleteGame",
          class: "GameCRUD",
          fixtureId: fixtureId,
          reason: reason,
          endpoint: endpoint,
        }
      );

      // Update fixture with deleted flag and reason
      // Note: This assumes your Strapi schema has isDeleted and deletedAt fields
      // Adjust the fields based on your actual schema
      await fetcher(`${endpoint}/${fixtureId}`, "PUT", {
        data: {
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletionReason: reason,
        },
      });

      logger.info(`Fixture soft deleted from ${endpoint}: ${fixtureId}`, {
        method: "softDeleteGame",
        class: "GameCRUD",
        fixtureId: fixtureId,
        reason: reason,
      });
      return { deleted: true, fixtureId, mode: "soft" };
    } catch (error) {
      logger.error(`Error soft deleting fixture from ${endpoint}: ${error}`, {
        method: "softDeleteGame",
        class: "GameCRUD",
        fixtureId: fixtureId,
        endpoint: endpoint,
      });
      throw error;
    }
  }
  // Implement any additional CRUD methods needed for game operations
}

module.exports = GameCRUD;
