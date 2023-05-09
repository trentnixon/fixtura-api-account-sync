const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");
const qs = require("qs");

class assignCompetitionsToAssociation {
  async Setup(competitions, associationId) {
    logger.debug(`Assigning competitions to association ${associationId}`);

    const promises = [];

    for (const competition of competitions) {
      if (competition.competitionUrl === undefined) {
        logger.warn("Undefined competition URL encountered");
        continue;
      }

      const isExisting = await this.checkIfCompetitionExists(
        getLastItemInUrl(competition.competitionUrl),
        "competitions"
      );

      if (!isExisting) {
        logger.debug(`Adding new competition: ${competition.competitionName}`);
        competition.association = [associationId];
        promises.push(fetcher("competitions", "POST", { data: competition }));
      } else {
        logger.debug(
          `Updating existing competition: ${competition.competitionName}`
        );
        competition.association = [associationId];
        promises.push(
          fetcher(`competitions/${isExisting[0].id}`, "PUT", {
            data: competition,
          })
        );
      }
    }

    await Promise.all(promises);

    return {
      success: true,
    };
  }

  async checkIfCompetitionExists(competitionId, resourcePath) {
    const query = qs.stringify(
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

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length > 0 ? response : false;
    } catch (error) {
      logger.error(`Error checking for competition ${competitionId}:`, error);
      return false;
    }
  }
}

module.exports = assignCompetitionsToAssociation;

function getLastItemInUrl(url) {
  // Split the URL by '/' character
  const urlParts = url.split("/");
  // Get the last item in the URL
  const lastItem = urlParts[urlParts.length - 1];
  return lastItem;
}
