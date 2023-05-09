const fetcher = require("../../Utils/fetcher");
const qs = require("qs");
const logger = require("../../Utils/logger");

function createQuery(competitionId) {
  return qs.stringify(
    {
      filters: {
        competitionId: {
          $eq: competitionId,
        },
      },
    },
    {
      encodeValuesOnly: true,
    }
  );
}

class assignCompetitionsToAssociation {
  async Setup(competitions, associationId) {
    const promises = [];

    for (const competition of competitions) {
      const isExisting = await this.checkIfCompetitionExists(
        competition.competitionId,
        "competitions"
      );
      if (!isExisting) {
        //console.log("ADD NEW", isExisting);
        competition.association = [associationId];
        promises.push(fetcher("competitions", "POST", { data: competition }));
      } else {
        //console.log("Update", isExisting);
        promises.push(
          fetcher(`competitions/${isExisting}`, "PUT", { data: competition })
        );
        logger.info(`${competition.competitionName} is stored.`);
      }
    }

    await Promise.all(promises);

    return {
      success: true,
    };
  }

  async checkIfCompetitionExists(competitionId, resourcePath) {
    const query = createQuery(competitionId);

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response[0]?.id === undefined ? false : response[0].id;
      //return response.length > 0;
    } catch (error) {
      logger.error(`Error checking for competition ${competitionId}:`, error);
      return false;
    }
  }
}

module.exports = assignCompetitionsToAssociation;
