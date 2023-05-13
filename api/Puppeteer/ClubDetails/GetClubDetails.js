/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */
const BaseController = require("../../../common/BaseController");
const fetcher = require("../../Utils/fetcher");
// getters
const GetCompetitions = require("./getCompetitions");
const GetClubTeams = require("./getClubTeams");
const getTeamsGameData = require("./getTeamsGameData");

// setters
const assignClubToCompetition = require("../AssociationCompetitions/assignClubToCompetition");
const AssignTeamToClub = require("./assignTeamtoClub");
// utils
const logger = require("../../Utils/logger");
const qs = require("qs");

class GetClubDetails extends BaseController {
  constructor() {
    super(); // Add this line
    this.dependencies = require("../../../common/dependencies");
  }

  async processClub(ACCOUNTID) {
    const Account = await fetcher(
      `accounts/${ACCOUNTID}?${getApprovedClubAccounts()}`
    );
    const CLUBID = Account.attributes.clubs.data[0].id;

    try {
      /* Step 1 */
      // Get the Comps for this club
      const competitions = await this.processCompetitions(Account);
      if (!competitions) return false;
      /* Step 2 */
      // Assign the selected club to the Comps found
      await this.processAssignClubToCompetition(competitions, CLUBID);
      /* Step 3 */
      // Refetch the club from Strapi for the new Data and IDS
      const ActiveClub = await this.reFetchClubData(CLUBID);
      /* Step 4 */
      // Find all of the Teams Associatiated with this Club
      const ListOfTeamsInClub = await this.processClubTeams(ActiveClub);
      console.log("ListOfTeamsInClub", ListOfTeamsInClub);

      /* Step 5 */
      // Now assign those teams to the Club ID
      await this.processTeamsToClub(CLUBID, ListOfTeamsInClub);

      /* Step 6 */
      // Get the Game Data for the Teams found
      //     await this.processTeamsGameData(CLUBID);

      return true;
    } catch (error) {
      logger.error(`Error processing club ${Account.id}:`, error);
      return { complete: true };
    }
  }

  async reFetchClubData(CLUBID) {
    return await fetcher(`clubs/${CLUBID}?${getClubRelations()}`);
  }

  async processAssignClubToCompetition(competitions, CLUBID) {
    const uploader = new assignClubToCompetition();
    await uploader.setup(competitions, CLUBID);
  }

  async processCompetitions(Account) {
    const getCompetitionsObj = new GetCompetitions(
      Account.attributes.clubs.data[0].attributes.href,
      this.browser
    );
    return await getCompetitionsObj.setup();
  }

  async processClubTeams(ActiveClub) {
    const ClubTeams = new GetClubTeams(null, this.browser); // pass the browser instance here
    return await ClubTeams.setup(
      ActiveClub.attributes.club_to_competitions.data
    );
  }

  async processTeamsToClub(CLUBID, ClubTeamsresult) {
    const TeamToClub = new AssignTeamToClub();
    await TeamToClub.Setup(ClubTeamsresult, CLUBID);
  }

  async processTeamsGameData(CLUBID) {
    let ActiveClubTeams = await fetcher(
      `clubs/${CLUBID}?${getClubRelations()}`
    );
    //console.log(ActiveClubTeams)
    const TeamsGameData = new getTeamsGameData(
      ActiveClubTeams.attributes.teams,
      extractGradesVersion2(ActiveClubTeams)
    );
    TeamsGameData.setBrowser(this.browser);
    ActiveClubTeams=null
    await TeamsGameData.Setup();
  }

  async setup(accountId) {
    console.log("TEST 1 . GetClubDetails Setup called");
    try {
      await this.initDependencies(accountId); // Call the initDependencies method from the BaseController
      const result = await this.processClub(accountId);
      return result;
    } catch (err) {
      logger.error("Error during setup:", err);

      await this.dependencies.changeisUpdating(accountId, false);
      logger.info("Set Account to False| ERROR ");
      await this.dependencies.createDataCollection(accountId, { error: true });
      logger.info("Create a Data Entry | ERROR");
    } finally {
      await this.dependencies.changeisUpdating(accountId, false);
      logger.info("Set Account to False| Finally ");
      await this.dependencies.createDataCollection(accountId, { error: true });
      logger.info("Create a Data Entry | Finally");
      await this.dispose();
      logger.info("Dispose of items and Pupeteer | Finally");
    }
  }
}

module.exports = GetClubDetails;

const getApprovedClubAccounts = () => {
  return qs.stringify(
    {
      populate: ["associations", "account_type", "clubs"],
    },
    {
      encodeValuesOnly: true,
    }
  );
};

const getClubRelations = () => {
  return qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },

      populate: [
        "href",
        "competitions",
        "teams",
        "teams.grades",
        "club_to_competitions",
        "club_to_competitions.club",
        "club_to_competitions.competition",
        "club_to_competitions.competition.grades",
        "teams.game_meta_data",
      ],
    },
    {
      encodeValuesOnly: true,
    }
  );
};

function extractGradesVersion2(activeClubTeams) {
  const ListedTeams = activeClubTeams.attributes.teams?.data;
  //console.log(ListedTeams);
  const gradesArray = ListedTeams.map((item) => {
    return item.attributes.grades.data;
  });

  const flattenedGradesArray = [].concat(...gradesArray);

  const resultArray = flattenedGradesArray.map((grade) => {
    return {
      Name: grade.attributes.gradeName,
      ID: grade.id,
    };
  });

  return resultArray;
}
