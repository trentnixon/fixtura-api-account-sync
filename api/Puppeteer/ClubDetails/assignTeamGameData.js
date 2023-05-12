const fetcher = require("../../Utils/fetcher");
const qs = require("qs");

class assignTeamToGameData {
  async Setup(GameData) {
    const promises = [];
   
    for (const Games of GameData) {
      if (Games.teamHomeID === undefined) {
        console.log(`Games.teamHomeID was Undefined ${Games.teamHomeID}`);
        continue;
      }


      const isExisting = await this.checkIfCompetitionExists(
        Games.gameID,
        "game-meta-datas" 
      );

      const HomeTeamID = await this.GetTeamsIDS(Games.teamHomeID);
      const AwayTeamID = await this.GetTeamsIDS(Games.teamAwayID);

      //console.log("HomeTeamID res ", HomeTeamID, 'on', Games.teamHomeID)
      //console.log("AwayTeamID res ", AwayTeamID, 'on', Games.teamHomeID)
      HomeTeamID ? Games.teams.push(HomeTeamID) : false;
      AwayTeamID ? Games.teams.push(AwayTeamID) : false;

      //console.log('Games.teams : ',Games.teams, 'on', Games.teamHomeID)
      if (!isExisting) {
     
        promises.push(fetcher("game-meta-datas", "POST", { data: Games }));
      } else {
      
        promises.push(
          fetcher(`game-meta-datas/${isExisting}`, "PUT", { data: Games })
        );
      }
    }

    await Promise.all(promises);

    return {
      success: true,
    };
  }

  async checkIfCompetitionExists(gameID, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          gameID: {
            $eq: gameID,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      return response.length === 0 ? false : response[0].id;
    } catch (error) {
      console.error(`Error checking for competition ${gameID}:`, error);
      return false;
    }
  }

  GetTeamsIDS = async (teamID) => {
    const query = qs.stringify(
      {
        filters: {
          teamID: {
            $eq: teamID,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );
    try {
      const response = await fetcher(`teams?${query}`);
      return response.length === 0 ? false : response[0].id;
    } catch (error) {
      console.error(`Error checking teamID${teamID}:`, error);
      return false;
    }
  };

  checkIfClubToCompisAlreadyStored = async (competition) => {
    //club-to-competitions
    const query = qs.stringify(
      {
        filters: {
          competitionUrl: {
            $eq: Games.competitionUrl,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );
    try {
      const response = await fetcher(`club-to-competitions?${query}`);
      return response.length === 0 ? false : true;
    } catch (error) {
      console.error(
        `Error checking club-to-competitions ${competitionId}:`,
        error
      );
      return false;
    }
  };
}

module.exports = assignTeamToGameData;
