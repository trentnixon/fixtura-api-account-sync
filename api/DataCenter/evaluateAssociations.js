const logger = require("../Utils/logger");
const { getAssociationObj, getDetailedAssociationDetails } = require("./utils");

async function dataCenterAssociations(fromStrapi) {
  try {
    // Get the Account Details for the Association
    const associationObj = await getAssociationObj(fromStrapi.ID);
    const details = await getDetailedAssociationDetails(associationObj.TYPEID);
  

    console.log(details)

    return {
      TYPEOBJ: associationObj,
      ACCOUNT: { ACCOUNTID: fromStrapi.ID, ACCOUNTTYPE: fromStrapi.PATH },
      DETAILS:details,
      Grades: createArrGrades(details.attributes.competitions.data),
      TEAMS: createTeamsArr(details.attributes.competitions.data),
    };
  } catch(error) {
    console.error(error);
    
    logger.critical("An error occurred in dataCenterAssociations", {
      file: "evaluateAssociations.js",
      function: "dataCenterAssociations",
      error: error,
    });
  }
}

const createTeamsArr = (obj) => {
  const arr = [];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  obj.forEach((comps) => {
    const startDate = new Date(comps.attributes.startDate);

    // If startDate is more than one year ago, skip this iteration
    if (startDate < oneYearAgo) {
      return;
    }

    comps.attributes.teams.data.forEach((team) => {
      arr.push({
        teamName: team.attributes.teamName,
        id: team.id,
        href: team.attributes.href,
        grade: team.attributes.grades?.data[0]?.id,
      });
    });
  });

  return arr;
};

const createArrGrades = (details) => {
  return details.reduce((arr, deets) => {
    const gradeArr = deets.attributes.grades.data.map((url) => ({
      compID: deets.id,
      compName: deets.attributes.competitionName,
      id: url.id,
      gradeName: url.attributes.gradeName,
      url: url.attributes.url,
    }));

    return [...arr, ...gradeArr];
  }, []);
};
module.exports = { dataCenterAssociations };