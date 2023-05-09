const fetcher = require("../../Utils/fetcher");
const qs = require("qs");
const logger = require("../../Utils/logger");

function createCompetitionQuery(competitionName) {
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

function createClubToCompetitionQuery(competition) {
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

class assignCompetitionsToAssociation {
  async Setup(competitions, ClubId) {
    const promises = [];

    for (const competition of competitions) {
      const isExisting = await this.checkIfCompetitionExists(
        competition.competitionName,
        "competitions"
      );

      if (isExisting) {
        competition.club = [ClubId];
        competition.competition = [isExisting[0].id];

        const isStored = await this.checkIfClubToCompisAlreadyStored(
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
    const query = createCompetitionQuery(competitionName);

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response;
    } catch (error) {
      logger.error(`Error checking for competition ${competitionName}:`, error);
      return false;
    }
  }

  async checkIfClubToCompisAlreadyStored(competition) {
    const query = createClubToCompetitionQuery(competition);

    try {
      const response = await fetcher(`club-to-competitions?${query}`);
      return response.length === 0 ? false : true;
    } catch (error) {
      logger.error(
        `Error checking club-to-competitions ${competition.competitionName}:`,
        error
      );
      return false;
    }
  }
}

module.exports = assignCompetitionsToAssociation;
