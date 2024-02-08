const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");

class CompetitionUpdater {
  constructor(dataObj) {
    this.dataObj = dataObj;
  }

  async updateClubCompetition(competition, existingCompetitionId) {
    try {
      const updateData = {
        competitionName: competition.competitionName,
        url: competition.competitionUrl,
        orgName: competition.orgName,
        status: competition.status,
      };
      await fetcher(`competitions/${existingCompetitionId}`, "PUT", { data: updateData });
      logger.info(`Competition updated for club: ${competition.competitionName}`);
    } catch (error) {
      throw new Error(`Error updating competition for club: ${error}`);
    }
  }

  async updateAssociationCompetition(competition, existingCompetitionId) {
    try {
      const updateData = {
        // Other fields can be updated as necessary
        association: [this.dataObj.TYPEOBJ.TYPEID],
      };
      await fetcher(`competitions/${existingCompetitionId}`, "PUT", { data: updateData });
      logger.info(`Competition updated for association: ${competition.competitionName}`);
    } catch (error) {
      throw new Error(`Error updating competition for association: ${error}`);
    }
  }
}

module.exports = CompetitionUpdater;
