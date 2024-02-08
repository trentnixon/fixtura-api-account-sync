const ProcessingTracker = require("../services/processingTracker");
const GameCRUD = require("./games/GameCrud");
const logger = require("../../src/utils/logger");

class AssignGameData {
  constructor(games, dataObj, batchSize = 10) {
    this.games = games;
    this.dataObj = dataObj;
    this.gameCRUD = new GameCRUD(dataObj);
    this.processingTracker = ProcessingTracker.getInstance();
    this.batchSize = batchSize; // Defines the size of each batch
  }

  // Entry point for processing the games in batches
  async setup() {
    const totalBatches = Math.ceil(this.games.length / this.batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const currentBatch = this.games.slice(
        i * this.batchSize,
        (i + 1) * this.batchSize
      );
      await this.processBatch(currentBatch);
    }
    return { success: true };
  }

  // Processes a single batch of games
  async processBatch(batch) {
    for (const game of batch) {
     
      try {
        const [homeTeamID, awayTeamID] = await this.gameCRUD.getTeamsIds([
          game.teamHomeID,
          game.teamAwayID,
        ]);
        if (homeTeamID && awayTeamID) {
          game.teams = [homeTeamID, awayTeamID];
          await this.processGame(game);
        } else {
          logger.error(`Team IDs not found for game ${game.gameID}`);
        }
      } catch (error) {
        logger.error(
          `Error in AssignGameData processBatch method for game ${game.gameID}:`
        );
        console.log(error);
        this.processingTracker.errorDetected("games");
      }
    }
  }

  // Processes an individual game
  async processGame(game) {
    try {
      const existingGame = await this.gameCRUD.checkIfGameExists(game.gameID);
      if (existingGame) {
        this.processingTracker.itemUpdated("games");
        await this.gameCRUD.updateGame(existingGame.id, game);
      } else {
        this.processingTracker.itemNew("games");
        await this.gameCRUD.createGame(game);
      }
    } catch (error) {
      logger.error(`Error processing individual game ${game.gameID}:`);
      console.log(error);
      throw error;
    }
  }
}

module.exports = AssignGameData;
