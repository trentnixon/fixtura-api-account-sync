const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");
const qs = require("qs");


class AssignTeamToClub {
  async convertGradeLinkIDToGrade(gradeLinkIDs) {
    const strapiIDs = [];
    for (const gradeLinkID of gradeLinkIDs) {
      const strapiID = await this.getStrapiGradeIDFromPlayHQID(gradeLinkID);
      strapiIDs.push(strapiID[0].id); 
    }
    return strapiIDs;
  }

  async Setup(ClubTeamsresult, CLUBID) {
    try {
      logger.info(`Setup started for Club ID: ${CLUBID}`);
      const combinedClubTeams = this.combineClubTeams(ClubTeamsresult);
     // logger.info(`Combined club teams: ${JSON.stringify(combinedClubTeams)}`);

      const getGrades = await this.getClub(CLUBID);
     // logger.info(`Club data retrieved: ${JSON.stringify(getGrades)}`);
      
      const TeamStrapiIDS = this.getTeamStrapiIds(getGrades);
     // logger.info(`Team Strapi IDs: ${JSON.stringify(TeamStrapiIDS)}`);

      const processedTeams = await this.processTeams(
        combinedClubTeams,
        TeamStrapiIDS
      );
    
      await this.storeTeams(processedTeams);
      logger.info("Teams stored successfully");

      return { success: true };
    } catch (error) {
      logger.error(`Error setting up teams:`, error);
      return { success: false };
    }
  }

  combineClubTeams(ClubTeamsresult) {
    return ClubTeamsresult.reduce((accumulator, team) => {
      const existingTeamIndex = accumulator.findIndex(
        (t) => t.teamID === team.teamID
      );

      if (existingTeamIndex !== -1) {
        accumulator[existingTeamIndex].gradeLinkID.push(...team.gradeLinkID);
      } else {
        accumulator.push(team);
      }

      return accumulator;
    }, []);
  }

  getTeamStrapiIds(getGrades) {
    return getGrades.attributes.teams.data.map((item) => {
      return {
        id: item.id,
        name: item.attributes.teamName,
      };
    });
  }

  async processTeams(combinedClubTeams, TeamStrapiIDS) {
    const processedTeams = [];

    for (const Team of combinedClubTeams) {
      try {
        Team.grades = await this.convertGradeLinkIDToGrade(Team.gradeLinkID);

        const teamObj = TeamStrapiIDS.find(
          (team) => team.name === Team.teamName
        );

        const isExisting = await this.checkIfTeamExists(Team.teamID, "teams");

        if (!isExisting) {
          processedTeams.push({ action: "POST", data: Team });
        } else {
          processedTeams.push({ action: "PUT", id: teamObj.id, data: Team });
          logger.info(`${teamObj.name} is stored so updating details.`);
        }
      } catch (error) {
        logger.error(`Error processing team ${Team.teamName}:`, error);
      }
    }

    return processedTeams;
  }

  async storeTeams(processedTeams) {
    logger.info("Storing teams...");
    const promises = processedTeams.map((team) => {
      return fetcher(
        `teams${team.action === "PUT" ? `/${team.id}` : ""}`,
        team.action,
        { data: team.data }
      );
    });

    await Promise.all(promises);
    logger.info("Teams stored");
  }

  async checkIfTeamExists(teamID, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          teamID: {
            $eq: teamID,
          },
        },
        populate: ["grade"],
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length === 0 ? false : response;
    } catch (error) {
      console.error(`Error checking for Team ${teamID}:`, error);
      return false;
    }
  }

  async getClub(CLUBID) {
    logger.info(
      `Fecth Active Club Teams on CLUBID : ${CLUBID} : Page assignTeamtoClub.js`
    );
    try {
      return await fetcher(`clubs/${CLUBID}?${getClubRelations()}`);
    } catch (err) {
      logger.error(`Error getting club with ID ${CLUBID}:`, err);
    }
  }
 
  async getStrapiGradeIDFromPlayHQID(PLAYHQGRADEID) {
    logger.info(
      `Fecth Strapi ID Teams on PLAYHQ ID  : ${PLAYHQGRADEID} : Page assignTeamtoClub.js`
    );
    try {
      return await fetcher(`grades?${getGradeID(PLAYHQGRADEID)}`);
    } catch (err) {
      logger.error(`Error getting GradeID with ID ${PLAYHQGRADEID}:`, err);
    }
  }
}

module.exports = AssignTeamToClub;

const getClubRelations = () => {
  return qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },

      populate: [
        "teams",
        "club_to_competitions",
        "club_to_competitions.club",
        "club_to_competitions.competition",
        "club_to_competitions.competition.grades",
      ],
    },
    {
      encodeValuesOnly: true,
    }
  );
};

const getGradeID = (ID) => {
  return qs.stringify(
    {
      filters: {
        gradeId: {
          $eq: ID,
        },
      },
    },
    {
      encodeValuesOnly: true,
    }
  );
};
