/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const GetTeams = require("./getTeams");
const getTeamsGameData = require("./getTeamsGameData");
const assignIntTeamsToAssociation = require("./assignIntTeams");
const fetcher = require("../../Utils/fetcher");
const qs = require("qs");

class GetNoClubDetails {
  constructor() {
    this.browser = null;
  } 

  setBrowser(browser) {
    this.browser = browser;
  }

  async setup(competition) {
    try {
      let getCompTeams = new GetTeams(this.browser);
      let teamList = await getCompTeams.setup(competition);
       
      const assignTeam = new assignIntTeamsToAssociation();
      await assignTeam.setup(teamList);
      getCompTeams = null
      teamList = null
     /*  let activeCompetition = await fetcher(
        `competitions/${competition.id}?${getCompetitionRelations()}`
      );

      const teamsGameData = new getTeamsGameData(
        activeCompetition.attributes.teams
      );
      teamsGameData.setBrowser(this.browser);
      await teamsGameData.setup();

      activeCompetition=null */
      return true;
    } catch (error) {
      console.error(`Error processing Association `, error);
    } finally {
      // Dispose of resources if needed
    }
    return { complete: true };
  }
}

module.exports = GetNoClubDetails;

const getCompetitionRelations = () => {
  return qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },
      populate: ["association", "teams", "teams.grades", "teams.game_meta_data"],
    },
    {
      encodeValuesOnly: true,
    }
  );
};
