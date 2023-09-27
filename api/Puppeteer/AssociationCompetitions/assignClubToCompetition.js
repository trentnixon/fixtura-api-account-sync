/** 
 * SOLID APPROVED  
 * DO NOT ADJUST UNLESS ERROR IN CODE
*/

const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");
const qs = require("qs");

class CompetitionQueryBuilder {
  static createCompetitionQuery(competitionName) {
    return qs.stringify(
      {
        filters: {
          competitionName: {
            $eq: competitionName,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );
  }

  static createClubToCompetitionQuery(competition) {
    return qs.stringify(
      {
        filters: {
          competitionUrl: {
            $eq: competition.competitionUrl,
          },
          club: {
            id: { $eq: competition.club },
          },
          competition: {
            id: { $eq: competition.competition },
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );
  }
}

class assignClubToCompetition { 
  async setup(competitions, clubId) {
    const promises = [];


    // club assign comp to something
    for (const competition of competitions) {

        console.log("AssignCompetitionsToAssociation", competition)
      const existingCompetitions = await this.checkIfCompetitionExists(
        competition.competitionName,
        "competitions"
      );

      if (existingCompetitions && existingCompetitions.length > 0) {


        competition.club = [clubId];
        competition.competition = [existingCompetitions[0].id];

        const isStored = await this.checkIfClubToCompIsAlreadyStored(
          competition
        );

        if (!isStored) { 
          promises.push(
            fetcher("club-to-competitions", "POST", { data: competition })
          );  
        } else { 
          logger.info(`${competition.competitionName} is already in Strapi`);
          return {
            success: true,
          };
        }
      } else {
        logger.info(`${competition.competitionName} is not a competition.`);
        return {
          success: false,
        };
      }
    }

    await Promise.all(promises);

    return {
      success: true,
    };
  }

  async checkIfCompetitionExists(competitionName, resourcePath) {
    const query = CompetitionQueryBuilder.createCompetitionQuery(
      competitionName
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response;
    } catch (error) {
      logger.error(`Error checking for competition ${competitionName}:`, error);
      logger.critical("An error occurred in checkIfCompetitionExists", {
        file: "assignClubToCompetition.js",
        function: "checkIfCompetitionExists",
        error: error,
      });
      return false;
    }
  }

  async checkIfClubToCompIsAlreadyStored(competition) {
    const query = CompetitionQueryBuilder.createClubToCompetitionQuery(
      competition
    );

    try {
      const response = await fetcher(`club-to-competitions?${query}`);
      return response.length === 0 ? false : true;
    } catch (error) {
      logger.error(
        `Error checking club-to-competitions ${competition.competitionName}:`,
        error
      );
      logger.critical("An error occurred in checkIfClubToCompIsAlreadyStored", {
        file: "assignClubToCompetition.js",
        function: "checkIfClubToCompIsAlreadyStored",
        error: error,
      });
      return false;
    }
  }
}

module.exports = assignClubToCompetition;
