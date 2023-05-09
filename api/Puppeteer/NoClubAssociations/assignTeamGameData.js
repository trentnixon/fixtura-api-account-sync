const fetcher = require("../../Utils/fetcher");
const qs = require("qs");
const logger = require("../../Utils/logger");

/*
{
  round: 'Round 7',
  date: 'Sunday, 15 January 2023',
  type: 'One Day',
  time: '10:00 AM, Sun, 15 Jan 23',
  ground: 'Runaway Bay Cricket Club / Sam Loxton Oval 1',
  status: 'Final',
  urlToScoreCard: 'https://www.playhq.com/cricket-australia/org/cricket-gold-coast-ltd/cricket-gold-coast-senior-competition-summer-202223/taper-over-40-division-3/game-centre/37c3b2b5',
  team: [ 82 ],
  gameID: '37c3b2b5',
  teamHome: 'Runaway Bay Over 40 Div 3',
  teamAway: 'Coomera Hope Island Over 40 Div 3 White'
}
*/
class assignTeamToGameData {
  async Setup(GameData) {
    const promises = [];
    for (const Games of GameData) {

      if(Games.teamHomeID === undefined)
        {
          //console.log(`Games.teamHomeID was Undefined ${Games.teamHomeID}`) 
          continue
        }

      const isExisting = await this.checkIfCompetitionExists(
        Games.gameID,
        "game-meta-datas"  
      );

      const HomeTeamID = await this.GetTeamsIDS(Games.teamHomeID);
      const AwayTeamID = await this.GetTeamsIDS(Games.teamAwayID); 
      HomeTeamID ? Games.teams.push(HomeTeamID) : false;
      AwayTeamID ? Games.teams.push(AwayTeamID) : false;

      if (!isExisting) {

        logger.info(`Storing game ${Games.gameID}`);
        promises.push(fetcher("game-meta-datas", "POST", { data: Games }));
      } else {
        logger.info(
          `Game ${Games.gameID} is already stored. Updating it.`
        );
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
