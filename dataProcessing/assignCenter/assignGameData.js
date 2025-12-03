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

      // MEMORY FIX: Clear batch reference after processing
      // Note: currentBatch is a slice, but clearing helps GC
      // The main this.games array will be cleared by caller after setup() completes
    }

    // MEMORY FIX: Clear games array after all batches processed
    // The data has been sent to CMS, we don't need it anymore
    this.games = null;

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
        logger.error("Error in AssignGameData processBatch", {
          error: error.message,
          stack: error.stack,
          gameID: game?.gameID,
        });
        this.processingTracker.errorDetected("games");
      }
    }
  }

  // Processes an individual game
  async processGame(game) {
    try {
      const existingGame = await this.gameCRUD.checkIfGameExists(game.gameID);

      // Handle null response (actual errors like connection issues)
      if (existingGame === null) {
        logger.warn(
          `Could not determine if game exists - API returned null or unexpected format. Skipping game ${game.gameID}`,
          {
            method: "processGame",
            class: "AssignGameData",
            gameID: game.gameID,
          }
        );
        // Mark as error but don't throw - allow processing to continue
        this.processingTracker.errorDetected("games");
        return;
      }

      // existingGame is either false (new game) or a game object (existing game)
      if (existingGame) {
        this.processingTracker.itemUpdated("games");
        await this.gameCRUD.updateGame(existingGame.id, game);
      } else {
        logger.info(`Creating new game: ${game.gameID}`, {
          method: "processGame",
          class: "AssignGameData",
          gameID: game.gameID,
        });
        this.processingTracker.itemNew("games");
        await this.gameCRUD.createGame(game);
      }
    } catch (error) {
      logger.error(`Error processing individual game ${game.gameID}`, {
        error: error.message,
        stack: error.stack,
        gameID: game.gameID,
      });
      throw error;
    }
  }
}

module.exports = AssignGameData;
