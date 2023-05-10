// Pupeteer
const GetTeams = require("./getTeams");
const getTeamsGameData = require("./getTeamsGameData");
const getFixutreResults = require("./getFixutreResults");
const GetAssociationLadder = require("./getAssociationLadder");
// Assign
const assignIntTeamsToAssociation = require("./assignIntTeams");
// Utils
const fetcher = require("../../Utils/fetcher");

const qs = require("qs");

class getNoClubDetails {
  constructor() {
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async Setup(COMPETITION) {
    //console.log(`getNoClubDetails run COMPETITION `);

    try {
      /* **************************************************************************** */
      // Step 1: Get the Teams from the Ladder, this is a INT step
      /* **************************************************************************** */
      const getCompTeams = new GetTeams();
      getCompTeams.setBrowser(this.browser);
      const TeamList = await getCompTeams.setup(COMPETITION);
 
      /* **************************************************************************** */
      // Step 2: Assign teams to grade and Cmp
      /* **************************************************************************** */

      const assignTeam = new assignIntTeamsToAssociation();
      const assigned = await assignTeam.setup(TeamList);
      //console.log("assigned", assigned);

      /* **************************************************************************** */
      // Step 3.5 // Refetch the Comps
      /* **************************************************************************** */

      const ActiveCompetition = await fetcher(
        `competitions/${COMPETITION.id}?${getCompetitionRelations()}`
      );

      /* **************************************************************************** */
      // Step 3: Get  Games data for the teams
      /* **************************************************************************** */

      const TeamsGameData = new getTeamsGameData(
        ActiveCompetition.attributes.teams
      );
      TeamsGameData.setBrowser(this.browser);
      await TeamsGameData.Setup();

      /* **************************************************************************** */
      // Step 4 // Fixture to Team and Grade
      /* **************************************************************************** */
      const FixutreResults = new getFixutreResults();
      FixutreResults.setBrowser(this.browser);
      await FixutreResults.Setup(ActiveCompetition.attributes.teams);

      /* **************************************************************************** */
      // Step 5 // Get the Grade Ladders
      /* **************************************************************************** */

      const getAssoicationLadder = new GetAssociationLadder();
      getAssoicationLadder.setBrowser(this.browser);
      await getAssoicationLadder.setup(ActiveCompetition);

      return true;
    } catch (error) {
      console.error(`Error processing Association `, error);
    }
    return { complete: true };
  }
}

module.exports = getNoClubDetails;

const getCompetitionRelations = () => {
  return qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },

      populate: ["association", "teams", "teams.grade", "teams.game_meta_data"],
    },
    {
      encodeValuesOnly: true,
    }
  );
};
