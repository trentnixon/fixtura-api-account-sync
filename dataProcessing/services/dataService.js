const logger = require("../../src/utils/logger");
const {
  getClubObj,
  getDetailedClubDetails,
  getAssociationObj,
  getDetailedAssociationDetails,
} = require("../utils/ProcessorUtils");
const CRUDOperations = require("./CRUDoperations");

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
    teamsData.forEach(team => {
      team.attributes.grades.data.forEach(grade => {
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

    competitionsData.forEach(comp => {
      const startDate = new Date(comp.attributes.startDate);

      // If startDate is more than one year ago, skip this iteration
      if (startDate < oneYearAgo) {
        return;
      }

      comp.attributes.teams.data.forEach(team => {
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
    const today = new Date();
    const fourteenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 14
    );

    competitionsData.forEach(comp => {
      const endDate = new Date(
        comp.attributes.competition.data.attributes.endDate
      );

      if (
        comp.attributes.competition.data.attributes.grades.data &&
        endDate > fourteenDaysAgo
      ) {
        comp.attributes.competition.data.attributes.grades.data.forEach(
          grades => {
            arr.push({
              club: [clubId],
              compID: comp.attributes.competition.data.id,
              compName:
                comp.attributes.competition.data.attributes.competitionName,
              id: grades.id,
              gradeName: grades.attributes.gradeName,
              url: grades.attributes.url,
            });
          }
        );
      }
    });
    return arr;
  }

  createArrGradesForAssociation(details) {
    const today = new Date();
    const fourteenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 14
    );

    return details.reduce((arr, comp) => {
      const endDate = new Date(comp.attributes.endDate);

      // Proceed only if the competition's end date is within the last 14 days
      if (endDate > fourteenDaysAgo) {
        const gradeArr = comp.attributes.grades.data.map(grade => ({
          compID: comp.id,
          compName: comp.attributes.competitionName,
          id: grade.id,
          gradeName: grade.attributes.gradeName,
          url: grade.attributes.url,
          endDate: endDate,
          // No club ID included for associations
        }));
        return [...arr, ...gradeArr];
      } else {
        return arr;
      }
    }, []);
  }

  async initCreateDataCollection(accountId) {
    try {
      //console.log("Creating Data Collection for Account ID:", accountId);
      const currentDate = new Date();
      const CRUD = new CRUDOperations();
      const dataCollectionId = await CRUD.createDataCollection(accountId, {
        account: [accountId],
        whenWasTheLastCollection: currentDate,
      });

      //console.log("Data Collection Created with ID:", dataCollectionId);
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
