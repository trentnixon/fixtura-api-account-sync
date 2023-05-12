/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const fetcher = require("../../Utils/fetcher");
// has Pupeteer
const GetCompetitions = require("./getCompetitions"); 
const GetClubTeams = require("./getClubTeams");
const getTeamsGameData = require("./getTeamsGameData");

// isAssign
const assignClubToCompetition = require("../AssociationCompetitions/assignClubToCompetition");
const AssignTeamToClub = require("./assignTeamtoClub");
// utils
const logger = require("../../Utils/logger");
const qs = require("qs");

class ClubDetailsHandler {
  constructor(fetcher, browser) {
    this.fetcher = fetcher;
    this.browser = browser;
    this.dependencies = require("../../../common/dependencies");
  }

  async processClub(ACCOUNTID) {
    const Account = await this.fetcher(
      `accounts/${ACCOUNTID}?${getApprovedClubAccounts()}`
    );
    const CLUBID = Account.attributes.clubs.data[0].id;

    try {
      /* Step 1 */
      // Get the Comps for this club
      const competitions = await this.processCompetitions(Account);
      if (!competitions) return false; 
      // console.log(competitions)

      /* Step 2 */
      // Assign the selected club to the Comps found
      await this.processAssignClubToCompetition(competitions, CLUBID);

      /* Step 3 */
      // Refetch the club from Strapi for the new Data and IDS
      const ActiveClub = await this.reFetchClubData(CLUBID);
      //console.log(ActiveClub)
      /* Step 4 */
      // Find all of the Teams Associatiated with this Club
      const ListOfTeamsInClub = await this.processClubTeams(ActiveClub);
      //console.log(ListOfTeamsInClub)
      /* Step 5 */
      // Now assign those teams to the Club ID
      await this.processTeamsToClub(CLUBID, ListOfTeamsInClub);

      /* Step 6 */
      // Get the Game Data for the Teams found
//       await this.processTeamsGameData(CLUBID);

      /* Step 7 */
      // Update the UI
      //await this.dependencies.changeisUpdating(ACCOUNTID, false);
      /* Step 7 */
      // Add this data collection
      //await this.createDataCollection(ACCOUNTID, { error: false });


      return true;
    } catch (error) {
      logger.error(`Error processing club ${Account.id}:`, error);
      return { complete: true };
    }
  }

  async reFetchClubData(CLUBID) {
    return await this.fetcher(`clubs/${CLUBID}?${getClubRelations()}`);
  }
  async createDataCollection(ID, ERR) {
    //data-collections
    const currentDate = new Date();
    await fetcher(`data-collections`, `POST`, {
      data: {
        account: [ID],
        whenWasTheLastCollection: currentDate,
      },
    });
    return true;
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
    const ActiveClubTeams = await this.fetcher(
      `clubs/${CLUBID}?${getClubRelations()}`
    );
    //console.log(ActiveClubTeams)
    const TeamsGameData = new getTeamsGameData(
      ActiveClubTeams.attributes.teams,
      extractGradesVersion2(ActiveClubTeams)
    );
    TeamsGameData.setBrowser(this.browser);
    await TeamsGameData.Setup();
  }
}

class GetClubDetails {
  constructor(fetcher, browser) {
    this.clubDetailsHandler = new ClubDetailsHandler(fetcher, browser);
    this.dependencies = require("../../../common/dependencies");
  }

  async Setup(ACCOUNTID) {
    console.log('TEST 3 . GetClubDetails Setup called');
    await this.dependencies.changeisUpdating(ACCOUNTID, true);
    return await this.clubDetailsHandler.processClub(ACCOUNTID);
  }
 
  dispose() {
    // Implement a dispose method if needed for cleanup
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

/* const extractGrades = (activeClubTeams) => {
  const club_to_competitions =
    activeClubTeams.attributes.club_to_competitions.data;

  const gradesArray = club_to_competitions.map((item) => {
    return item.attributes.competition.data.attributes.grades.data;
  });

  // Flatten the gradesArray into a single array of objects
  const flattenedGradesArray = [].concat(...gradesArray);

  const resultArray = flattenedGradesArray.map((grade) => {
    return {
      Name: grade.attributes.gradeName,
      ID: grade.id,
    };
  });

  return resultArray;
}; */

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
