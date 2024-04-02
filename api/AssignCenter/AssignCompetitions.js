/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */

const fetcher = require("../Utils/fetcher");
const logger = require("../Utils/logger");
const qs = require("qs");

class AssignCompetitions {
  constructor(competitions, DATAOBJ) {
    this.competitions = competitions;
    this.DATAOBJ = DATAOBJ;
  }


  async checkIfClubToCompIsAlreadyStored(competition) {
   
    const query = qs.stringify(
      {
        filters: {
          competitionUrl: {
            $eq: competition.competitionUrl,
          },
          club: {
            id: { $eq: competition.club },
          },
          competition: {
            id: { $eq: competition.competition },
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
      const response = await fetcher(`club-to-competitions?${query}`);
      //console.log("CHECK RES=== ", response); 
      return response.length === 0 ? false : true;
    } catch (error) {
      logger.error(
        `Error checking club-to-competitions ${competition.competitionName}:`,
        error
      );

      logger.critical("An error occurred in checkIfClubToCompIsAlreadyStored", {
        file: "AssignCompetitions.js",
        function: "checkIfClubToCompIsAlreadyStored",
        error: error,
      });
      return false;
    }
  }

  async setup() {
    //console.log("this.competitions = ", this.competitions?.length);

    const promises = [];

    for (const competition of this.competitions) {
      if (competition.competitionUrl === undefined) {
        logger.error("Undefined competition URL encountered");
        continue;
      }

      const isExisting = await this.checkIfCompetitionExists(
        getLastItemInUrl(competition.competitionUrl),
        "competitions"
      );

      if (isExisting && isExisting.length > 0) {
        if (this.DATAOBJ.ACCOUNT.ACCOUNTTYPE === "CLUB") {
          // Process Club Competitions
          competition.club = [this.DATAOBJ.TYPEOBJ.TYPEID];
          competition.competition = [isExisting[0].id];

          //console.log("Check competition: ", competition);
          const isStored = await this.checkIfClubToCompIsAlreadyStored(
            competition
          );
          //console.log("Check competition RESULTS: ", isStored);

          if (!isStored) {
            promises.push(
              fetcher("club-to-competitions", "POST", { data: competition })
            );
          } else {
            logger.info(`${competition.competitionName} is already in Strapi`);
          }
          //console.log(competition);
          //console.log(`competitions/${isExisting[0].id}`);
        } else {
          // Process Association Competitions
          logger.debug(
            `Updating existing competition: ${competition.competitionName}`
          );
          competition.association = [this.DATAOBJ.TYPEOBJ.TYPEID];
        }

        promises.push(
          fetcher(`competitions/${isExisting[0].id}`, "PUT", {
            data: competition,
          })
        );
      } else {
        logger.info(
          `${competition.competitionName} is not a competition. Should be added in next General Run`
        );

        // UPDATE: not sure i need this, as comps are added in the general func which runs once a week

        //check over this, it adds the new comp, need to add the association and or clubIDS

        /*  this.DATAOBJ.ACCOUNT.ACCOUNTTYPE === "CLUB" ? false: competition.association = [associationId]
        logger.debug(`Adding new competition: ${competition.competitionName}`);
        console.log(competition)
        promises.push(fetcher("competitions", "POST", { data: {
            url:competition.competitionUrl,
            competitionName:competition.competitionName
        } })); */
      }
    }

    await Promise.all(promises);
    //throw new Error("STOP HERE");
    return {
      success: true,
    };
  }

  async checkIfCompetitionExists(competitionId, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          competitionId: {
            $eq: competitionId,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
  
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length > 0 ? response : false;
    } catch (error) {
      logger.error(`Error checking for competition ${competitionId}:`, error);
      logger.critical("An error occurred in checkIfClubToCompIsAlreadyStored", {
        file: "AssignCompetitions.js",
        function: "checkIfCompetitionExists",
        error: error,
      });
      return false;
    }
  }
}

module.exports = AssignCompetitions;

function getLastItemInUrl(url) {
  //console.log("try spliting", url);
  // Split the URL by '/' character
  const urlParts = url.split("/");

  // If the last item is "teams", return the second-to-last item
  if (urlParts[urlParts.length - 1] === "teams") {
    return urlParts[urlParts.length - 2];
  }

  // Otherwise, return the last item
  return urlParts[urlParts.length - 1];
}
