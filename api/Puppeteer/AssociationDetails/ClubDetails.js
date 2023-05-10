const fetcher = require("../../Utils/fetcher");
// use Pupeteer
const getCompetitions = require("../ClubDetails/getCompetitions");
const getClubTeams = require("../ClubDetails/getClubTeams");
const getTeamsGameData = require("../ClubDetails/getTeamsGameData");
const getFixutreResults = require("../ClubDetails/OLD_getFixutreResults");
// isAssign
const assignClubToCompetition = require("../AssociationCompetitions/assignClubToCompetition");
const assignTeamToClub = require("../ClubDetails/assignTeamtoClub");
// utils
const logger = require("../../Utils/logger");
const qs = require("qs");
const getGradeLadders = require("./getGradeLadder");


class getClubDetails {
  constructor() {
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async Setup(CLUBID, CLUBURL) {
    logger.debug(`Update Club ${CLUBID} on ${CLUBURL}`); 

    try {
      /* **************************************************************************** */
      // Step 2: Check the club's competition page and update any old ones
      /* **************************************************************************** */

      const getCompetitionsObj = new getCompetitions(CLUBURL);
      getCompetitionsObj.setBrowser(this.browser);
      const competitions = await getCompetitionsObj.Setup();

      // if no results then exit out of class
      if (!competitions) {
        logger.debug(`No competitions found for club ${CLUBID}`);
        return false;
      }

      /* **************************************************************************** */
      // Step 3: Store and assign competitions to club
      /* **************************************************************************** */

      const uploader = new assignClubToCompetition();
      await uploader.Setup(competitions, CLUBID);

      /* **************************************************************************** */
      // Step 3.5 Refetch Club Detials
      /* **************************************************************************** */

      const ActiveClub = await fetcher(`clubs/${CLUBID}?${getClubRelations()}`);

      /* **************************************************************************** */
      // Step 4 // Refetch the Club on its ID, Get the Teams!!!
      /* **************************************************************************** */
      // problem CLASS: error in class
      const ClubTeams = new getClubTeams();
      ClubTeams.setBrowser(this.browser);
      const ClubTeamsresult = await ClubTeams.Setup(
        ActiveClub.attributes.club_to_competitions.data
      );

      /* **************************************************************************** */
      // Step 5 // Store Teams to Clubs and Comps
      /* **************************************************************************** */
      const TeamToClub = new assignTeamToClub();
      await TeamToClub.Setup(ClubTeamsresult, CLUBID);

      /* **************************************************************************** */
      // Step 6 // Fixture to Team and Grade
      /* **************************************************************************** */
      logger.info(
        `Fecth Active Club Teams on CLUBID : ${CLUBID} : Page ClubDetails.js`
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
      // Step 7 // Fixture to Team and Grade
      /* **************************************************************************** */
      const FixutreResults = new getFixutreResults();
      FixutreResults.setBrowser(this.browser);
      await FixutreResults.Setup(ActiveClubTeams.attributes.teams);

       /* **************************************************************************** */
      // Step 8 // Get the Grade Ladders
      /* **************************************************************************** */

      console.log("ActiveClubTeams")
      console.log(ActiveClubTeams.attributes.teams.data)
      const GetTheGradeLadder = new getGradeLadders(
        ActiveClubTeams.attributes.teams,
        extractGrades(ActiveClubTeams)  
      );
      GetTheGradeLadder.setBrowser(this.browser);
      await GetTheGradeLadder.Setup();



      // FINISHED
      return true;
    } catch (error) {
      logger.error(`Error processing Association`, error);
    }

    return { complete: true };
  }
}

module.exports = getClubDetails;

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
