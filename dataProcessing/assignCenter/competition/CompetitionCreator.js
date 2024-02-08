const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");

class CompetitionCreator {
  constructor(dataObj) {
    this.dataObj = dataObj;
  }

  async createCompetitionEntry(competition) {
    try {
      const newCompetitionData = {
        competitionName: competition.competitionName,
        competitionUrl: competition.competitionUrl,
        orgName: competition.orgName,
        status: competition.status,
      };
      const response = await fetcher("competitions", "POST", { data: newCompetitionData });
      return response.id; // Assuming response contains the ID of the created competition
    } catch (error) {
      throw new Error(`Error creating new competition: ${error}`);
    }
  }

  async createClubToCompetitionLink(competitionData) {
    try {
      await fetcher("club-to-competitions", "POST", { data: competitionData });
      logger.info(`Club to competition link created for competition: ${competitionData.competition}`);
    } catch (error) {
      throw new Error(`Error creating club to competition link: ${error}`);
    }
  }

  async createAssociationToCompetitionLink(competitionData) {
    try {
      await fetcher("association-to-competitions", "POST", { data: competitionData });
      logger.info(`Association to competition link created for competition: ${competitionData.competition}`);
    } catch (error) {
      throw new Error(`Error creating association to competition link: ${error}`);
    }
  }
}

module.exports = CompetitionCreator;
