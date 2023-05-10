const fetcher = require("../../Utils/fetcher");
// has Pupeteer
const getCompetitions = require("./getCompetitions");
const getClubTeams = require("./getClubTeams");
const getTeamsGameData = require("./getTeamsGameData");

// isAssign
const assignClubToCompetition = require("../AssociationCompetitions/assignClubToCompetition");
const assignTeamToClub = require("./assignTeamtoClub");
// utils
const logger = require("../../Utils/logger");
const qs = require("qs");

class getClubDetails {
  constructor() {
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser; 
  }
  

  async Setup(ACCOUNTID) {
    //console.log(`Update Accont ${ACCOUNTID}`);
    /* **************************************************************************** */
    // Step 1: Collect approved and active club accounts from the DB
    /* **************************************************************************** */
    const Account = await fetcher( `accounts/${ACCOUNTID}?${getApprovedClubAccounts()}`);

    // Let the DB know this Account it updating
    //await changeisUpdating(ACCOUNTID, true);
    const CLUBID = Account.attributes.clubs.data[0].id;

    try {
      /* **************************************************************************** */
      // Step 2: Check the club's competition page and update any old ones
      /* **************************************************************************** */

      const getCompetitionsObj = new getCompetitions(
        Account.attributes.clubs.data[0].attributes.href
      );
      getCompetitionsObj.setBrowser(this.browser);
      const competitions = await getCompetitionsObj.Setup();
    
      //console.log("competitions", competitions)
      // if no results then exit out of class
      if (!competitions) {
        //console.log(`No competitions found for club ${CLUBID}`);
        // create new data colletion ID
        // Let the DB know this Account it updating
        await changeisUpdating(ACCOUNTID, false);
        await createDataCollection(ACCOUNTID, { error: false });
        // return false back to the paent
        return false;
      }

      /* **************************************************************************** */
      // Step 3: Store and assign competitions to club
      /* **************************************************************************** */

      const uploader = new assignClubToCompetition();
      const result = await uploader.Setup(competitions, CLUBID);
      //console.log(`Assigned competitions to club: ${result.success}`);

      /* **************************************************************************** */
      // Step 3.5 Refetch Club Details
      /* **************************************************************************** */
      const ActiveClub = await fetcher(`clubs/${CLUBID}?${getClubRelations()}`);

      /* **************************************************************************** */
      // Step 4 // Refetch the Club on its ID, Get the Teams!!!
      /* **************************************************************************** */

      const ClubTeams = new getClubTeams();
      ClubTeams.setBrowser(this.browser);
      const ClubTeamsresult = await ClubTeams.Setup(
        ActiveClub.attributes.club_to_competitions.data
      );
      //console.log(`${ClubTeamsresult.length}`)

      /* **************************************************************************** */
      // Step 5 // Store Teams to Clubs and Comps
      /* **************************************************************************** */
      const TeamToClub = new assignTeamToClub();
      await TeamToClub.Setup(ClubTeamsresult, CLUBID);
      

      /* **************************************************************************** */
      // Step 6 // Fixture to Team and Grade
      /* **************************************************************************** */
      logger.info(
        `Fecth Active Club Teams on CLUBID : ${CLUBID} : Page ClubDetails/index.js`
      );
      const ActiveClubTeams = await fetcher(
        `clubs/${CLUBID}?${getClubRelations()}`
      );


      const TeamsGameData = new getTeamsGameData( 
        ActiveClubTeams.attributes.teams,
        extractGrades(ActiveClubTeams)
      );
      TeamsGameData.setBrowser(this.browser);
      await TeamsGameData.Setup();

      /* **************************************************************************** */
      // Step 8 // let the DB know that a data collection happened
      /* **************************************************************************** */
      // Let the DB know this Account it updating
      await changeisUpdating(ACCOUNTID, false);
      await createDataCollection(ACCOUNTID, { error: false });

      return true;
    } catch (error) {
      console.error(`Error processing club ${Account.id}:`, error);
    } 

    //await browser.close();
    return { complete: true };
  }

  dispose() {
    // Implement a dispose method if needed for cleanup
  }
}

module.exports = getClubDetails;

const createDataCollection = async (ID, ERR) => {
  //data-collections
  const currentDate = new Date();
  await fetcher(`data-collections`, `POST`, {
    data: {
      account: [ID],
      whenWasTheLastCollection: currentDate,
    },
  });
  return true;
};

const changeisUpdating = async (ID, isUpdating) => {
  //data-collections
  const currentDate = new Date();
  await fetcher(`accounts/${ID}`, `PUT`, {
    data: {
      isUpdating: isUpdating,
    },
  });
  return true;
};

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
        "teams.grade",
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

const extractGrades = (activeClubTeams) => {
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
};
