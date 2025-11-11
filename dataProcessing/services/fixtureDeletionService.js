const logger = require("../../src/utils/logger");
const GameCRUD = require("../assignCenter/games/GameCrud");
const ProcessingTracker = require("./processingTracker");

/**
 * FixtureDeletionService handles deletion of invalid or missing fixtures.
 * Supports both hard delete and soft delete (mark as deleted).
 */
class FixtureDeletionService {
  constructor(dataObj, options = {}) {
    this.dataObj = dataObj;
    this.gameCRUD = new GameCRUD(dataObj);
    this.processingTracker = ProcessingTracker.getInstance();
    this.deleteMode = options.deleteMode || "soft"; // "hard" or "soft"
    this.enabled = options.enabled !== false; // Default to enabled
    this.batchSize = options.batchSize || 10;
  }

  /**
   * Deletes a single fixture
   * @param {number} fixtureId - Database ID of the fixture to delete
   * @param {string} gameID - Game ID of the fixture
   * @param {string} reason - Reason for deletion
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFixture(fixtureId, gameID, reason) {
    if (!this.enabled) {
      logger.info(
        `Deletion disabled, skipping fixture ${fixtureId} (gameID: ${gameID})`
      );
      return {
        deleted: false,
        reason: "deletion_disabled",
        fixtureId,
        gameID,
      };
    }

    try {
      if (this.deleteMode === "hard") {
        // Hard delete - PERMANENT removal from database (CANNOT be recovered)
        logger.warn(
          `[CLEANUP] ⚠️ PERMANENTLY DELETING fixture ${fixtureId} (gameID: ${gameID}) - This action cannot be undone`,
          {
            reason,
            fixtureId,
            gameID,
            mode: "hard",
            warning: "PERMANENT DELETION - DATA CANNOT BE RECOVERED",
          }
        );
        await this.gameCRUD.deleteGame(fixtureId);
        logger.info(
          `[CLEANUP] ✅ Hard deleted fixture ${fixtureId} (gameID: ${gameID}) - PERMANENTLY REMOVED`,
          {
            reason,
            fixtureId,
            gameID,
            mode: "hard",
          }
        );
        this.processingTracker.itemDeleted("games");
        return {
          deleted: true,
          mode: "hard",
          fixtureId,
          gameID,
          reason,
          permanent: true,
        };
      } else {
        // Soft delete - mark as deleted
        await this.gameCRUD.softDeleteGame(fixtureId, reason);
        logger.info(
          `[CLEANUP] Soft deleted fixture ${fixtureId} (gameID: ${gameID})`,
          {
            reason,
            fixtureId,
            gameID,
          }
        );
        this.processingTracker.itemDeleted("games");
        return {
          deleted: true,
          mode: "soft",
          fixtureId,
          gameID,
          reason,
        };
      }
    } catch (error) {
      logger.error(`Error deleting fixture ${fixtureId} (gameID: ${gameID})`, {
        error: error.message,
        stack: error.stack,
        reason,
        fixtureId,
        gameID,
      });
      this.processingTracker.errorDetected("games");
      return {
        deleted: false,
        error: error.message,
        fixtureId,
        gameID,
        reason,
      };
    }
  }

  /**
   * Deletes multiple fixtures in batches
   * @param {Array<Object>} fixturesToDelete - Array of fixtures to delete with { fixtureId, gameID, reason }
   * @returns {Promise<Object>} Deletion results
   */
  async deleteFixtures(fixturesToDelete) {
    if (!this.enabled) {
      logger.info(
        `Deletion disabled, skipping ${fixturesToDelete.length} fixtures`
      );
      return {
        total: fixturesToDelete.length,
        deleted: 0,
        failed: 0,
        skipped: fixturesToDelete.length,
        results: [],
      };
    }

    if (fixturesToDelete.length === 0) {
      logger.info("No fixtures to delete");
      return {
        total: 0,
        deleted: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    if (this.deleteMode === "hard") {
      logger.error(
        `[CLEANUP] ⚠️⚠️⚠️ STARTING HARD DELETE - ${fixturesToDelete.length} fixture(s) will be PERMANENTLY REMOVED (CANNOT be recovered)`,
        {
          count: fixturesToDelete.length,
          mode: this.deleteMode,
          warning: "PERMANENT DELETION - DATA CANNOT BE RECOVERED",
        }
      );
    } else {
      logger.info(
        `[CLEANUP] Starting deletion of ${fixturesToDelete.length} fixtures (mode: ${this.deleteMode})`
      );
    }

    const results = [];
    const batches = [];

    // Split into batches
    for (let i = 0; i < fixturesToDelete.length; i += this.batchSize) {
      batches.push(fixturesToDelete.slice(i, i + this.batchSize));
    }

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      logger.info(
        `[CLEANUP] Processing deletion batch ${batchIndex + 1}/${
          batches.length
        } (${batch.length} fixtures)`
      );

      // Delete all fixtures in batch (can be parallelized if needed)
      const batchResults = await Promise.all(
        batch.map((fixture) =>
          this.deleteFixture(fixture.fixtureId, fixture.gameID, fixture.reason)
        )
      );

      results.push(...batchResults);

      // Log batch progress
      const deletedCount = batchResults.filter((r) => r.deleted).length;
      const failedCount = batchResults.filter(
        (r) => !r.deleted && r.error
      ).length;
      logger.info(
        `[CLEANUP] Batch ${
          batchIndex + 1
        } complete: ${deletedCount} deleted, ${failedCount} failed`
      );

      // Small delay between batches to avoid overwhelming the API
      if (batchIndex < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const totalDeleted = results.filter((r) => r.deleted).length;
    const totalFailed = results.filter((r) => !r.deleted && r.error).length;
    const totalSkipped = results.filter((r) => !r.deleted && !r.error).length;

    logger.info(
      `[CLEANUP] Deletion complete: ${totalDeleted} deleted, ${totalFailed} failed, ${totalSkipped} skipped out of ${results.length} fixtures`
    );

    return {
      total: fixturesToDelete.length,
      deleted: totalDeleted,
      failed: totalFailed,
      skipped: totalSkipped,
      results,
    };
  }
}

module.exports = FixtureDeletionService;
