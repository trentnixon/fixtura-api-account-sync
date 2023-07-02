const { getClubObj, getDetailedClubDetails } = require("./utils");

async function dataCenterClubs(fromStrapi) {
  try {
    const clubObj = await getClubObj(fromStrapi.ID);
    const details = await getDetailedClubDetails(clubObj.TYPEID);
    console.log(details)
    return {
      TYPEOBJ: clubObj,
      ACCOUNT: { ACCOUNTID: fromStrapi.ID, ACCOUNTTYPE: fromStrapi.PATH },
      DETAILS:details.attributes,
      TEAMS: createTeamsArr(details.attributes.teams.data),
      Grades: createArrGrades(details.attributes.club_to_competitions.data, clubObj.TYPEID),
    };
  } catch(error) {
    console.error(error);
  }
} 

const createTeamsArr = (obj) => {
  //console.log(obj)
  let arr = [];
  obj.forEach((team) => {
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
};

const createArrGrades = (details, clubId) => {
  let arr = [];
  details.forEach((deets) => {
    deets.attributes.competition.data.attributes.grades.data.forEach((comps) => {
      arr.push({
        club: [clubId],
        compID: deets.attributes.competition.data.id,
        compName: deets.attributes.competition.data.attributes.competitionName,
        id: comps.id,
        gradeName: comps.attributes.gradeName,
        url: comps.attributes.url,
      });
    });
  });
  return arr;
};

module.exports = { dataCenterClubs };
