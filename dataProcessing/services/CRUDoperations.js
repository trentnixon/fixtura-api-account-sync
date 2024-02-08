// Ensure correct path

const fetcher = require("../../src/utils/fetcher");
const logger = require("../../src/utils/logger");
const queryHelpers = require("../utils/queryHelpers");
const qs = require("qs");
 
class CRUDOperations {
  constructor() {}

  // Fetch data for clubs
  async fetchDataForClub(clubId) {
    try {
      const queryParams = queryHelpers.getClubRelationsForClub(clubId);
      const clubData = await fetcher(`clubs/${clubId}?${queryParams}`);
      return clubData;
    } catch (error) {
      logger.error("Error in CRUDOperations - fetchDataForClub", { error });
      throw error;
    }
  }

  // Fetch data for associations
  async fetchDataForAssociation(associationId) {
    try {
      const queryParams =
        queryHelpers.getClubRelationsForAssociation(associationId);
      const associationData = await fetcher(
        `associations/${associationId}?${queryParams}`
      );
      return associationData;
    } catch (error) {
      logger.error("Error in CRUDOperations - fetchDataForAssociation", {
        error,
      });
      throw error;
    }
  }

  // Create a data collection entry
  createDataCollection = async (accountId, data) => {
    try {
      const response = await fetcher(`data-collections`, "POST", { data });
      return response.id; // Assuming the response has an 'id' field for the data collection ID
    } catch (error) {
      throw new Error(
        `Failed to create data collection for account ${accountId}: ${error}`
      );
    }
  };

  // Update a data collection entry
  async updateDataCollection(dataCollectionId, updateData) {
    try {
      await fetcher(`data-collections/${dataCollectionId}`, "PUT", {
        data: updateData,
      });
    } catch (error) {
      logger.error("Error in CRUDOperations - updateDataCollection", { error });
      throw error;
    }
  }

  // Other CRUD operation methods...
  async createClubToCompetitionLink(competition) {
    try {
      const data = {
        // Construct the data structure for club-to-competition link
        // Example: { competitionUrl: competition.competitionUrl, ... }
      };
      return await fetcher("club-to-competitions", "POST", { data });
    } catch (error) {
      logger.error(`Error creating club-to-competition link: ${error}`);
      throw error;
    }
  }

  async fetchClubIdByPlayHQId(playHQId) { 
    const query = qs.stringify({
      filters: { PlayHQID: { $eq: playHQId } },
    }, { encodeValuesOnly: true });
  
    try {
      const response = await fetcher(`clubs?${query}`);
      return response.length > 0 ? response[0]?.id : null;
    } catch (error) {
      logger.error(`Error fetching club by PlayHQ ID: ${playHQId}`, { error });
      throw error;
    }
  }
}

module.exports = CRUDOperations;
