const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");
const qs = require("qs");

class CompetitionCRUD {
  constructor(dataObj) {
    this.dataObj = dataObj;
  }
  /**************************************************** */
  // GET
  /**************************************************** */
  async checkIfCompetitionExists(competitionId, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          competitionId: { $eq: competitionId },
        },
      },
      { encodeValuesOnly: true }
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length > 0 ? response : false;
    } catch (error) {
      throw new Error(`Error in checkIfCompetitionExists: ${error}`);
    }
  }

  async checkIfClubToCompIsAlreadyStored(competition) {
    const query = qs.stringify(
      {
        filters: {
          competitionUrl: { $eq: competition.url },
          club: { id: { $eq: competition.club } },
          competition: { id: { $eq: competition.competition } },
        },
      },
      { encodeValuesOnly: true }
    );

    try {
      const response = await fetcher(`club-to-competitions?${query}`);
      return response.length !== 0;
    } catch (error) {
      throw new Error(`Error in checkIfClubToCompIsAlreadyStored: ${error}`);
    }
  }

  async checkIfAssociationToCompIsAlreadyStored(competitionId, associationId) {

    // Build the query to check if the association is already linked to the competition
    const query = qs.stringify(
      {
        filters: {
          id: { $eq: competitionId },
          association: { id: { $eq: associationId } },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
      // Perform the query
      const response = await fetcher(`competitions?${query}`);
      // If response length is greater than 0, then the association is already linked
      return response.length > 0;
    } catch (error) {
      console.error(
        `Error in checkIfAssociationToCompIsAlreadyStored: ${error}`
      );
      throw new Error(
        `Error in checkIfAssociationToCompIsAlreadyStored: ${error}`
      );
    }
  }

  /**************************************************** */
  // PUT
  /**************************************************** */
  async updateClubCompetition(competition, existingCompetitionId) {
    try {

      // Update the competition in the database
      await fetcher(`competitions/${existingCompetitionId}`, "PUT", {
        data: competition,
      });
      logger.info(
        `Competition updated for club: ${competition.competitionName}`
      );

      // Step 2 & 3: Check and create a link in club-to-competitions if not exists
      const isLinked = await this.checkIfClubToCompIsAlreadyStored({
        competitionUrl: competition.url,
        club: [this.dataObj.TYPEOBJ.TYPEID],
        competition: [existingCompetitionId],
      });

      if (!isLinked) {
        // If not linked, create a new club-to-competition link
        await this.createClubToCompetitionLink({
          competitionUrl: competition.url,
          club: [this.dataObj.TYPEOBJ.TYPEID],
          competition: [existingCompetitionId],
        });
      }
    } catch (error) {
      throw new Error(`Error updating competition for club: ${error}`);
    }
  }

  async updateAssociationCompetition(competition, existingCompetitionId) {
    // Check if the association is already linked to the competition
    const isLinked = await this.checkIfAssociationToCompIsAlreadyStored(
      existingCompetitionId,
      this.dataObj.TYPEOBJ.TYPEID
    );
    if (!isLinked) {
      try {
        // If not linked, update the competition to link it with the association
        //competition.association = [this.dataObj.TYPEOBJ.TYPEID];
        await fetcher(`competitions/${existingCompetitionId}`, "PUT", { data: competition,});
        logger.info(
          `Competition updated for association: ${competition.competitionName}`
        );
      } catch (error) {
        throw new Error(`Error updating competition for association: ${error}`);
      }
    } else {
      logger.info(
        `Competition already linked to association: ${competition.competitionName}`
      );
    }
  }

  /**************************************************** */
  // POST
  /**************************************************** */
  async createCompetitionEntry(competition) {
    try {
      const response = await fetcher("competitions", "POST", {
        data: competition,
      });
      return response.id;
    } catch (error) {
      throw new Error(`Error creating new competition: ${error}`);
    }
  }

  async createClubToCompetitionLink(competitionData) {
    try {
      await fetcher("club-to-competitions", "POST", { data: competitionData });
      logger.info(
        `Club to competition link created for competition: ${competitionData.competition}`
      );
    } catch (error) {
      throw new Error(`Error creating club to competition link: ${error}`);
    }
  }

  async createAssociationToCompetitionLink(competitionData) {
    try {
      await fetcher("association-to-competitions", "POST", {
        data: competitionData,
      });
      logger.info(
        `Association to competition link created for competition: ${competitionData.competition}`
      );
    } catch (error) {
      throw new Error(
        `Error creating association to competition link: ${error}`
      );
    }
  }
}

module.exports = CompetitionCRUD;
