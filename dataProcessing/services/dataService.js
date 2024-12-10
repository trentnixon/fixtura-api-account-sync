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
    if (!Array.isArray(teamsData)) {
      logger.warn("Invalid teamsData provided to createTeamsArrForClub", {
        teamsData,
      });
      return arr;
    }

    teamsData.forEach(team => {
      try {
        if (!team?.attributes?.grades?.data) {
          logger.warn("Invalid team data structure", { team });
          return;
        }

        team.attributes.grades.data.forEach(grade => {
          if (!grade?.id) {
            logger.warn("Invalid grade data", { grade });
            return;
          }

          arr.push({
            teamName: team.attributes.teamName || "Unknown Team",
            id: team.id,
            href: team.attributes?.href || "",
            grade: grade.id,
          });
        });
      } catch (error) {
        logger.error("Error processing team in createTeamsArrForClub", {
          team,
          error: error.message,
        });
      }
    });
    return arr;
  }

  createTeamsArrForAssociation(competitionsData) {
    const arr = [];
    if (!Array.isArray(competitionsData)) {
      logger.warn(
        "Invalid competitionsData provided to createTeamsArrForAssociation",
        { competitionsData }
      );
      return arr;
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    competitionsData.forEach(comp => {
      try {
        if (!comp?.attributes?.startDate || !comp?.attributes?.teams?.data) {
          logger.warn("Invalid competition data structure", { comp });
          return;
        }

        const startDate = new Date(comp.attributes.startDate);
        if (startDate < oneYearAgo) {
          return;
        }

        comp.attributes.teams.data.forEach(team => {
          if (!team?.attributes) {
            logger.warn("Invalid team data", { team });
            return;
          }

          arr.push({
            teamName: team.attributes.teamName || "Unknown Team",
            id: team.id,
            href: team.attributes.href || "",
            grade: team.attributes.grades?.data?.[0]?.id || null,
          });
        });
      } catch (error) {
        logger.error(
          "Error processing competition in createTeamsArrForAssociation",
          {
            competition: comp,
            error: error.message,
          }
        );
      }
    });
    return arr;
  }

  createArrGradesForClub(competitionsData, clubId) {
    let arr = [];
    if (!Array.isArray(competitionsData) || !clubId) {
      logger.warn("Invalid input to createArrGradesForClub", {
        competitionsData,
        clubId,
      });
      return arr;
    }

    const today = new Date();
    const fourteenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 14
    );

    competitionsData.forEach(comp => {
      try {
        if (!comp?.attributes?.competition?.data) {
          logger.warn("Invalid competition data structure", { comp });
          return;
        }

        const compData = comp.attributes.competition.data;
        if (!compData?.attributes?.endDate) {
          logger.warn("Missing endDate in competition", { compData });
          return;
        }

        const endDate = new Date(compData.attributes.endDate);
        if (!compData.attributes?.grades?.data || endDate <= fourteenDaysAgo) {
          return;
        }

        compData.attributes.grades.data.forEach(grades => {
          if (!grades?.attributes) {
            logger.warn("Invalid grades data", { grades });
            return;
          }

          arr.push({
            club: [clubId],
            compID: compData.id,
            compName:
              compData.attributes.competitionName || "Unknown Competition",
            id: grades.id,
            gradeName: grades.attributes.gradeName || "Unknown Grade",
            url: grades.attributes.url || "",
          });
        });
      } catch (error) {
        logger.error("Error processing competition in createArrGradesForClub", {
          competition: comp,
          error: error.message,
        });
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
