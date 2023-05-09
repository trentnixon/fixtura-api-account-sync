const fetcher = require("../../Utils/fetcher");
const qs = require("qs");
const logger = require("../../Utils/logger");

function createQuery(gradeId) {
  return qs.stringify(
    {
      filters: {
        gradeId: {
          $eq: gradeId,
        },
      },
    },
    {
      encodeValuesOnly: true,
    }
  );
}

class assignGradesToCompetitions { 
  async Setup(grades) {
    const promises = [];

    for (const grade of grades) {
      const properties = Object.values(grade);
      const emptyProperties = properties.filter((prop) => !prop || prop.length === 0);

      if (emptyProperties.length === 0) {
        logger.info(`Skipping grade ${grade.gradeName} because it has empty or zero-length properties`);
        continue;
      }

      const isExisting = await this.checkIfCompetitionExists(grade.gradeId, "grades");

      if (!isExisting) {
        promises.push(fetcher("grades", "POST", { data: grade }));
      } else {
        logger.info(`${grade.gradeName} is stored.`);
      }
    }

    await Promise.all(promises);

    return {
      success: true,
    }; 
  }

  async checkIfCompetitionExists(gradeId, resourcePath) {
    const query = createQuery(gradeId);

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length > 0;
    } catch (error) {
      logger.error(`Error checking for competition ${gradeId}:`, error);
      return false;
    }
  }
}

module.exports = assignGradesToCompetitions;
