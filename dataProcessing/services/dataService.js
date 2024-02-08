const logger = require("../../src/utils/logger");
const {
  getClubObj,
  getDetailedClubDetails,
  getAssociationObj,
  getDetailedAssociationDetails,
} = require("../utils/ProcessorUtils");
const CRUDOperations = require("./CRUDOperations");

class DataService {
  constructor() {
    // Initialization code, if needed
  }
  async fetchData(fromStrapi) {
    if (fromStrapi.PATH === "CLUB") {
      return await this.fetchDataForClub(fromStrapi);
    } else if (fromStrapi.PATH === "ASSOCIATION") {
      return await this.fetchDataForAssociation(fromStrapi);
    } else {
      throw new Error("Invalid PATH value");
    }
  }
  async fetchDataForClub(fromStrapi) {
    try {
      const clubObj = await getClubObj(fromStrapi.ID);
      const details = await getDetailedClubDetails(clubObj.TYPEID);

      return this.structureClubData(fromStrapi, clubObj, details);
    } catch (error) {
      logger.critical("An error occurred in DataService - fetchDataForClub", {
        error: error,
      });
      throw error;
    }
  }

  async fetchDataForAssociation(fromStrapi) {
    try {
      const associationObj = await getAssociationObj(fromStrapi.ID);
      const details = await getDetailedAssociationDetails(
        associationObj.TYPEID
      );
      return this.structureAssociationData(fromStrapi, associationObj, details);
    } catch (error) {
      logger.critical(
        "An error occurred in DataService - fetchDataForAssociation",
        {
          error: error,
        }
      );
      throw error;
    }
  }

  // Utility methods for structuring data - Club
  structureClubData(fromStrapi, clubObj, details) {
    return {
      TYPEOBJ: clubObj,
      ACCOUNT: { ACCOUNTID: fromStrapi.ID, ACCOUNTTYPE: fromStrapi.PATH },
      DETAILS: details.attributes,
      TEAMS: this.createTeamsArrForClub(details.attributes.teams.data),
      Grades: this.createArrGradesForClub(
        details.attributes.club_to_competitions.data,
        clubObj.TYPEID
      ),
    };
  }

  // Utility methods for structuring data - Association
  structureAssociationData(fromStrapi, associationObj, details) {
    return {
      TYPEOBJ: associationObj,
      ACCOUNT: { ACCOUNTID: fromStrapi.ID, ACCOUNTTYPE: fromStrapi.PATH },
      DETAILS: details.attributes,
      Grades: this.createArrGradesForAssociation(
        details.attributes.competitions.data
      ),
      TEAMS: this.createTeamsArrForAssociation(
        details.attributes.competitions.data
      ),
    };
  }

  createTeamsArrForClub(teamsData) {
    let arr = [];
    teamsData.forEach((team) => {
      team.attributes.grades.data.forEach((grade) => {
        arr.push({
          teamName: team.attributes.teamName,
          id: team.id,
          href: team.attributes.href,
          grade: grade.id,
        });
      });
    });
    return arr;
  }

  createTeamsArrForAssociation(competitionsData) {
    const arr = [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    competitionsData.forEach((comp) => {
      const startDate = new Date(comp.attributes.startDate);

      // If startDate is more than one year ago, skip this iteration
      if (startDate < oneYearAgo) {
        return;
      }

      comp.attributes.teams.data.forEach((team) => {
        arr.push({
          teamName: team.attributes.teamName,
          id: team.id,
          href: team.attributes.href,
          grade: team.attributes.grades?.data[0]?.id, // Assuming the first grade is relevant
        });
      });
    });

    return arr;
  }

  createArrGradesForClub(competitionsData, clubId) {
    let arr = [];
    competitionsData.forEach((comp) => {
      if (comp?.attributes?.competition?.data?.attributes?.grades?.data) {
        comp?.attributes?.competition?.data?.attributes?.grades?.data.forEach(
          (comps) => {
            arr.push({
              club: [clubId],
              compID: comp.attributes.competition.data.id,
              compName:
                comp.attributes.competition.data.attributes.competitionName,
              id: comps.id,
              gradeName: comps.attributes.gradeName,
              url: comps.attributes.url,
            });
          }
        );
      }
    });
    return arr;
  }

  createArrGradesForAssociation(details) {
    return details.reduce((arr, comp) => {
      const gradeArr = comp.attributes.grades.data.map((grade) => ({
        compID: comp.id,
        compName: comp.attributes.competitionName,
        id: grade.id,
        gradeName: grade.attributes.gradeName,
        url: grade.attributes.url,
        // No club ID included for associations
      }));

      return [...arr, ...gradeArr];
    }, []);
  }

  async initCreateDataCollection(accountId) {
    try {
      console.log("Creating Data Collection for Account ID:", accountId);
      const currentDate = new Date();
      const CRUD = new CRUDOperations();
      const dataCollectionId = await CRUD.createDataCollection(accountId, {
        account: [accountId],
        whenWasTheLastCollection: currentDate,
      });

      console.log("Data Collection Created with ID:", dataCollectionId);
      return dataCollectionId;
    } catch (error) {
      logger.critical(
        "An error occurred in DataService - initCreateDataCollection",
        {
          file: "DataService.js",
          function: "initCreateDataCollection",
          accountId: accountId,
          error: error,
        }
      );
      throw error;
    }
  }
}

module.exports = DataService;
