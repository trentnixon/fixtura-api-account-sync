const logger = require("../../src/utils/logger");
const {
  getClubObj,
  getDetailedClubDetails,
  getAssociationObj,
  getDetailedAssociationDetails,
  fetchClubDirectData,
  fetchAssociationDirectData,
} = require("../utils/ProcessorUtils");
const CRUDOperations = require("./CRUDoperations");

class DataService {
  constructor() {
    // Initialization code, if needed
  }

  /**
   * Gets pseudo/sudo account ID for direct org processing.
   * Returns admin account ID from environment or null if not configured.
   *
   * @param {string} orgType - The organization type ("CLUB" or "ASSOCIATION")
   * @returns {number|null} - Admin account ID or null
   */
  getPseudoAccountId(orgType) {
    // Option A: Return null (if skipping account operations)
    // return null;

    // Option B: Return admin account ID (RECOMMENDED)
    // Get from environment variable, default to 1 if not set
    const adminAccountId = process.env.ADMIN_ACCOUNT_ID
      ? parseInt(process.env.ADMIN_ACCOUNT_ID, 10)
      : null;

    if (!adminAccountId) {
      logger.warn(
        "⚠️ ADMIN_ACCOUNT_ID not set in environment. Using null for pseudo account ID.",
        {
          orgType: orgType,
          note: "Account operations may fail if account ID is required",
        }
      );
      return null;
    }

    logger.debug("Using pseudo account ID for direct org processing", {
      orgType: orgType,
      pseudoAccountId: adminAccountId,
    });

    return adminAccountId;
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

  /**
   * Fetches data directly using org ID (bypasses account lookup).
   * Used for direct club/association ID processing.
   *
   * @param {number} orgId - The organization ID (club or association ID)
   * @param {string} orgType - The organization type ("CLUB" or "ASSOCIATION")
   * @returns {Promise<object>} - Structured data object with pseudo account ID
   */
  async fetchDataDirect(orgId, orgType) {
    try {
      if (orgType === "CLUB") {
        return await this.fetchDataForClubDirect(orgId);
      } else if (orgType === "ASSOCIATION") {
        return await this.fetchDataForAssociationDirect(orgId);
      } else {
        throw new Error(
          `Invalid org type: ${orgType}. Must be "CLUB" or "ASSOCIATION"`
        );
      }
    } catch (error) {
      logger.critical("An error occurred in DataService - fetchDataDirect", {
        orgId: orgId,
        orgType: orgType,
        error: error,
      });
      throw error;
    }
  }

  /**
   * Fetches club data directly using club ID (bypasses account lookup).
   * Creates pseudo account ID to satisfy data structure requirements.
   *
   * @param {number} clubId - The club ID to fetch directly
   * @returns {Promise<object>} - Structured data object
   */
  async fetchDataForClubDirect(clubId) {
    try {
      // Fetch club data directly (bypasses account lookup)
      const { clubObj, details } = await fetchClubDirectData(clubId);

      // Get pseudo account ID
      const pseudoAccountId = this.getPseudoAccountId("CLUB");

      // Create fromStrapi-like structure for compatibility
      const fromStrapi = {
        ID: pseudoAccountId, // Use pseudo account ID
        PATH: "CLUB",
      };

      // Structure data with pseudo account ID
      return this.structureClubData(fromStrapi, clubObj, details);
    } catch (error) {
      logger.critical(
        "An error occurred in DataService - fetchDataForClubDirect",
        {
          clubId: clubId,
          error: error,
        }
      );
      throw error;
    }
  }

  /**
   * Fetches association data directly using association ID (bypasses account lookup).
   * Creates pseudo account ID to satisfy data structure requirements.
   *
   * @param {number} associationId - The association ID to fetch directly
   * @returns {Promise<object>} - Structured data object
   */
  async fetchDataForAssociationDirect(associationId) {
    try {
      // Fetch association data directly (bypasses account lookup)
      const { associationObj, details } = await fetchAssociationDirectData(
        associationId
      );

      // Get pseudo account ID
      const pseudoAccountId = this.getPseudoAccountId("ASSOCIATION");

      // Create fromStrapi-like structure for compatibility
      const fromStrapi = {
        ID: pseudoAccountId, // Use pseudo account ID
        PATH: "ASSOCIATION",
      };

      // Structure data with pseudo account ID
      return this.structureAssociationData(fromStrapi, associationObj, details);
    } catch (error) {
      logger.critical(
        "An error occurred in DataService - fetchDataForAssociationDirect",
        {
          associationId: associationId,
          error: error,
        }
      );
      throw error;
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

    teamsData.forEach((team) => {
      try {
        if (!team?.attributes?.grades?.data) {
          logger.warn("Invalid team data structure", { team });
          return;
        }

        team.attributes.grades.data.forEach((grade) => {
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

    competitionsData.forEach((comp) => {
      try {
        if (!comp?.attributes?.startDate || !comp?.attributes?.teams?.data) {
          logger.warn("Invalid competition data structure", { comp });
          return;
        }

        const startDate = new Date(comp.attributes.startDate);
        if (startDate < oneYearAgo) {
          return;
        }

        comp.attributes.teams.data.forEach((team) => {
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

    competitionsData.forEach((comp) => {
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

        compData.attributes.grades.data.forEach((grades) => {
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
        const gradeArr = comp.attributes.grades.data.map((grade) => ({
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
