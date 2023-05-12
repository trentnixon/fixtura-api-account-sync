const fetcher = require("../../Utils/fetcher");
const GetCompetitions = require("../ClubDetails/getCompetitions");
const GetClubTeams = require("../ClubDetails/getClubTeams");
const getTeamsGameData = require("../ClubDetails/getTeamsGameData");
const assignClubToCompetition = require("../AssociationCompetitions/assignClubToCompetition");
const AssignTeamToClub = require("../ClubDetails/assignTeamtoClub");
const logger = require("../../Utils/logger");
const qs = require("qs");

class GetClubDetails {
  constructor() {
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  static getClubRelations() {
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
  }

  static extractGrades(activeClubTeams) {
    const club_to_competitions =
      activeClubTeams.attributes.club_to_competitions.data;

    const gradesArray = club_to_competitions.map((item) => {
      return item.attributes.competition.data.attributes.grades.data;
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

  static extractGradesVersion2(activeClubTeams) {
    const ListedTeams = activeClubTeams.attributes.teams.data;

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

  // HELPER
  async FetchClubsInAssociation(CLUBID) {
    return await fetcher(
      `clubs/${CLUBID}?${GetClubDetails.getClubRelations()}`
    );
  }

  async setup(CLUBID, CLUBURL) {
    logger.debug(`Update Club ${CLUBID} on ${CLUBURL}`);

    try { 
      const ListCompetitionsToAssociations = await this.processCompetitions(
        CLUBURL
      );

      if (!ListCompetitionsToAssociations) {
        logger.debug(`No competitions found for club ${CLUBID}`);
        return false;
      }
      const AssignListCompetitionsToAssociations =
        new assignClubToCompetition();
      await AssignListCompetitionsToAssociations.setup(
        ListCompetitionsToAssociations,
        CLUBID
      );

      const getActiveClubsInAssocaition = await this.FetchClubsInAssociation(
        CLUBID
      );
      const ListOfAssociationTeams = await this.processClubTeams(
        getActiveClubsInAssocaition
      );

      await this.processTeamsToClub(ListOfAssociationTeams, CLUBID);

      logger.info(
        `Fecth Active Club Teams on CLUBID : ${CLUBID} : Page ClubDetails.js`
      );

      await this.processTeamsGameData(CLUBID);

      return true;
    } catch (error) {
      logger.error(`Error processing Association`, error);
    }

    return { complete: true };
  }
  async processCompetitions(CLUBURL) {
    const getCompetitionsObj = new GetCompetitions(CLUBURL, this.browser);
    return await getCompetitionsObj.setup();
  }

  async processClubTeams(getActiveClubsInAssocaition) {
    const ClubTeams = new GetClubTeams(null, this.browser); // pass the browser instance here
    return await ClubTeams.setup(
      getActiveClubsInAssocaition.attributes.club_to_competitions.data
    );
  }

  async processTeamsToClub(ListOfAssociationTeams, CLUBID) {
    const AssignListOfTeamsToAssociation = new AssignTeamToClub();
    await AssignListOfTeamsToAssociation.Setup(ListOfAssociationTeams, CLUBID);
  }

  async processTeamsGameData(CLUBID) {
    const PrcessingClubFromStrapi = await this.FetchClubsInAssociation(CLUBID);
    const TeamsGameData = new getTeamsGameData(
      PrcessingClubFromStrapi.attributes.teams,
      GetClubDetails.extractGradesVersion2(PrcessingClubFromStrapi)  
    );
    TeamsGameData.setBrowser(this.browser);
    await TeamsGameData.Setup();
  }
}

module.exports = GetClubDetails;
