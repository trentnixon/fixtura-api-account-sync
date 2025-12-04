const FixtureComparisonService = require("../../../services/fixtureComparisonService");
const FixtureDeletionService = require("../../../services/fixtureDeletionService");
const logger = require("../../../../src/utils/logger");

/**
 * Fixture cleanup processing component
 */
class FixtureCleanupProcessorComponent {
  /**
   * Process fixture cleanup for the given data object
   * @param {object} dataObj - The data object containing account data
   * @param {object} context - Context object containing fixture data arrays
   * @param {Array} context.scrapedFixtures - Scraped fixtures from ProcessGames
   * @param {Array} context.fetchedFixtures - Fetched fixtures from ProcessFixtureValidation
   * @param {Array} context.fixtureValidationResults - Validation results from ProcessFixtureValidation
   * @param {object} processingTracker - Processing tracker instance
   */
  static async process(dataObj, context, processingTracker) {
    const { scrapedFixtures = [], fetchedFixtures = [], fixtureValidationResults = [] } = context;

    try {
      logger.info("[CLEANUP] Starting fixture cleanup process", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      // Log what data we have for comparison
      logger.info("[CLEANUP] Fixture cleanup data availability", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedFixturesCount: scrapedFixtures.length,
        fetchedFixturesCount: fetchedFixtures.length,
        validationResultsCount: fixtureValidationResults.length,
      });

      // Step 1: Compare fixtures using validation results and scraped fixtures
      // TESTING MODE: ProcessGames is disabled, so scrapedFixtures will be empty
      // In testing mode, we only identify fixtures with invalid URLs (404 errors)
      // Missing from scraped data will not be detected (since we're not scraping)
      // ProcessFixtureValidation validates existing DB fixtures for URL validity
      // Comparison identifies fixtures that are invalid (404) based on validation results only
      logger.info("[CLEANUP] Creating FixtureComparisonService", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const comparisonService = new FixtureComparisonService(dataObj);
      logger.info("[CLEANUP] FixtureComparisonService created successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      logger.info("[CLEANUP] Calling compareFixtures", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        scrapedCount: scrapedFixtures.length,
        fetchedCount: fetchedFixtures.length,
        validationCount: fixtureValidationResults.length,
        testingMode: true,
        note: "Only invalid URLs (404) will be detected in testing mode (no scraped data)",
      });

      // Compare: database fixtures vs validation results (and scraped fixtures from ProcessGames)
      // TESTING MODE: scrapedFixtures is empty, so only invalid URLs will be identified
      const comparisonResult = comparisonService.compareFixtures(
        scrapedFixtures, // Empty in testing mode (ProcessGames disabled)
        fetchedFixtures, // Database fixtures from validation step
        fixtureValidationResults // Validation results (identifies invalid URLs - 404 errors)
      );

      logger.info("[CLEANUP] compareFixtures returned successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        fixturesToDelete: comparisonResult.fixturesToDelete?.length || 0,
      });

      // ========================================
      // [DEBUG] LOG CLEANUP RESULTS BEFORE DELETION
      // ========================================
      logger.info("[CLEANUP] ===== CLEANUP RESULTS =====", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      logger.info("[CLEANUP] Fixture comparison complete", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        summary: comparisonResult.summary,
        fixturesToDelete: comparisonResult.fixturesToDelete.length,
        invalidUrls: comparisonResult.invalidFixtures?.length || 0,
        missingFromSource: comparisonResult.missingFixtures?.length || 0,
      });

      // Log detailed summary
      logger.info(`[CLEANUP] ===== CLEANUP SUMMARY =====`);
      logger.info(
        `[CLEANUP] Total fixtures to delete: ${comparisonResult.fixturesToDelete.length}`
      );
      logger.info(
        `[CLEANUP] Invalid URLs (404): ${
          comparisonResult.invalidFixtures?.length || 0
        }`
      );
      logger.info(
        `[CLEANUP] Missing from source: ${
          comparisonResult.missingFixtures?.length || 0
        }`
      );

      // Log fixtures that would be deleted
      if (comparisonResult.fixturesToDelete.length > 0) {
        logger.info(
          `[CLEANUP] ===== FIXTURES TO DELETE (${comparisonResult.fixturesToDelete.length} total) =====`
        );

        // Group by reason for better visibility
        const fixturesByReason = {};
        comparisonResult.fixturesToDelete.forEach((fixture) => {
          const reason = fixture.reason || "unknown";
          if (!fixturesByReason[reason]) {
            fixturesByReason[reason] = [];
          }
          fixturesByReason[reason].push(fixture);
        });

        // Log grouped by reason
        Object.keys(fixturesByReason).forEach((reason) => {
          logger.info(
            `[CLEANUP] Reason: ${reason} (${fixturesByReason[reason].length} fixtures)`
          );
        });

        // Log first 10 fixtures with details
        const fixturesToLog = comparisonResult.fixturesToDelete.slice(0, 10);
        fixturesToLog.forEach((fixture, index) => {
          logger.info(
            `[CLEANUP] Fixture ${index + 1}/${fixturesToLog.length}:`,
            {
              fixtureId: fixture.fixtureId || "N/A",
              gameID: fixture.gameID || "N/A",
              reason: fixture.reason || "unknown",
              status: fixture.status || "N/A",
              url: fixture.url || "N/A",
            }
          );
        });

        if (comparisonResult.fixturesToDelete.length > 10) {
          logger.info(
            `[CLEANUP] ... and ${
              comparisonResult.fixturesToDelete.length - 10
            } more fixtures to delete`
          );
        }

        logger.info("[CLEANUP] ===== END OF FIXTURES TO DELETE =====");
      } else {
        logger.info("[CLEANUP] No fixtures to delete - all fixtures are valid");
      }

      logger.info("[CLEANUP] ===== END CLEANUP RESULTS =====");

      // Step 2: Delete fixtures
      // Deletion is now ENABLED
      // To disable deletion, set deletionEnabled = false
      // deleteMode options:
      //   - "soft" = mark as deleted (recoverable, sets isDeleted flag)
      //   - "hard" = permanent removal (fixture completely deleted from database, CANNOT be recovered)
      const deletionEnabled = true; // ENABLED - will actually delete fixtures
      const deleteMode = "hard"; // "hard" = PERMANENT removal (⚠️ CANNOT be recovered), "soft" = mark as deleted (recoverable)

      if (deletionEnabled && comparisonResult.fixturesToDelete.length > 0) {
        // Enhanced warning for hard delete
        if (deleteMode === "hard") {
          logger.error(
            `[CLEANUP] ⚠️⚠️⚠️ HARD DELETE ENABLED - ${comparisonResult.fixturesToDelete.length} fixture(s) will be PERMANENTLY REMOVED from database (CANNOT be recovered)`,
            {
              count: comparisonResult.fixturesToDelete.length,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deleteMode: deleteMode,
              warning:
                "HARD DELETE - PERMANENT REMOVAL - DATA CANNOT BE RECOVERED",
              fixtures: comparisonResult.fixturesToDelete.map((f) => ({
                gameID: f.gameID,
                fixtureId: f.fixtureId,
                reason: f.reason,
              })),
            }
          );
        } else {
          logger.warn(
            `[CLEANUP] ⚠️ DELETION ENABLED - ${comparisonResult.fixturesToDelete.length} fixture(s) will be soft deleted (marked as deleted, recoverable)`,
            {
              count: comparisonResult.fixturesToDelete.length,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deleteMode: deleteMode,
              fixtures: comparisonResult.fixturesToDelete.map((f) => ({
                gameID: f.gameID,
                fixtureId: f.fixtureId,
                reason: f.reason,
              })),
            }
          );
        }
        logger.info(
          "[CLEANUP] Deletion enabled - proceeding with fixture deletion",
          {
            count: comparisonResult.fixturesToDelete.length,
            accountId: dataObj.ACCOUNT.ACCOUNTID,
            deleteMode: deleteMode,
          }
        );

        const deletionService = new FixtureDeletionService(dataObj, {
          deleteMode: deleteMode, // "soft" for safety (mark as deleted), "hard" for permanent removal
          enabled: true,
          batchSize: 10,
        });

        // Delete fixtures in batches
        const deleteResults = await deletionService.deleteFixtures(
          comparisonResult.fixturesToDelete
        );

        logger.info("[CLEANUP] Fixture deletion complete", {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          deleted: deleteResults.deleted,
          failed: deleteResults.failed,
          skipped: deleteResults.skipped,
          total: deleteResults.total,
        });
      } else {
        // No fixtures to delete OR deletion is disabled
        if (comparisonResult.fixturesToDelete.length === 0) {
          logger.info(
            "[CLEANUP] No fixtures to delete - all fixtures are valid and up-to-date",
            {
              fixturesToDelete: 0,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deletionEnabled: deletionEnabled,
            }
          );
        } else {
          logger.info(
            "[CLEANUP] Deletion disabled - fixtures would be deleted but deletion is not enabled",
            {
              fixturesToDelete: comparisonResult.fixturesToDelete.length,
              accountId: dataObj.ACCOUNT.ACCOUNTID,
              deletionEnabled: deletionEnabled,
            }
          );
        }
      }

      // Track cleanup results
      logger.info("[CLEANUP] Tracking cleanup results", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        fixturesToDeleteCount: comparisonResult.fixturesToDelete.length,
      });
      processingTracker.itemDeleted(
        "fixture-cleanup",
        comparisonResult.fixturesToDelete.length
      );
      logger.info("[CLEANUP] Cleanup results tracked successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });

      logger.info("[CLEANUP] Fixture cleanup process completed successfully", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        fixturesToDelete: comparisonResult.fixturesToDelete.length,
        fixturesToKeep: comparisonResult.fixturesToKeep.length,
      });
    } catch (error) {
      logger.error("[CLEANUP] Error in ProcessFixtureCleanup:", error);

      // Log error but don't throw - allow tracking to complete
      logger.warn(
        "[CLEANUP] Fixture cleanup error - continuing with other stages",
        {
          method: "ProcessFixtureCleanup",
          class: "DataController",
          error: error.message,
          accountId: dataObj.ACCOUNT.ACCOUNTID,
        }
      );
    }
  }
}

module.exports = FixtureCleanupProcessorComponent;

