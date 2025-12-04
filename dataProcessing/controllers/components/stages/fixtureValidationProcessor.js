const FixtureValidationProcessor = require("../../../processors/fixtureValidationProcessor");
const logger = require("../../../../src/utils/logger");

/**
 * Fixture validation processing component
 */
class FixtureValidationProcessorComponent {
  /**
   * Process fixture validation for the given data object
   * @param {object} dataObj - The data object containing account and fixture data
   * @returns {Promise<object>} - Object containing validation results and fetched fixtures
   */
  static async process(dataObj) {
    // MEMORY TRACKING: Import at function level so it's accessible throughout
    const { getMemoryStats } = require("../../../puppeteer/memoryUtils");
    const validationInitialMemory = getMemoryStats();

    try {
      logger.info("[VALIDATION] Starting fixture validation process", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        initialMemory: {
          rss: `${validationInitialMemory.rss}MB`,
          heapUsed: `${validationInitialMemory.heapUsed}MB`,
          heapTotal: `${validationInitialMemory.heapTotal}MB`,
        },
      });

      // Fetch and validate fixtures
      logger.info("[VALIDATION] Creating FixtureValidationProcessor", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const fixtureValidationProcessor = new FixtureValidationProcessor(
        dataObj
      );
      logger.info("[VALIDATION] Calling fixtureValidationProcessor.process()", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
      });
      const validationResult = await fixtureValidationProcessor.process();
      logger.info(
        "[VALIDATION] fixtureValidationProcessor.process() returned",
        {
          accountId: dataObj.ACCOUNT.ACCOUNTID,
          resultsCount: validationResult.results?.length || 0,
          fixturesCount: validationResult.fixtures?.length || 0,
        }
      );

      // ========================================
      // [DEBUG] LOG VALIDATION RESULTS BEFORE USE
      // ========================================
      logger.info("[VALIDATION] ===== VALIDATION RESULTS =====", {
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        validationResultsCount: validationResult.results?.length || 0,
        fetchedFixturesCount: validationResult.fixtures?.length || 0,
        validated: validationResult.validated || 0,
        valid: validationResult.valid || 0,
        invalid: validationResult.invalid || 0,
      });

      if (
        validationResult.results &&
        validationResult.results.length > 0
      ) {
        logger.info(
          `[VALIDATION] ===== ${validationResult.results.length} VALIDATION RESULTS =====`
        );

        // Log summary statistics
        const validCount = validationResult.results.filter(
          (r) => r.valid === true
        ).length;
        const invalidCount = validationResult.results.filter(
          (r) => r.valid === false
        ).length;
        const noUrlCount = validationResult.results.filter(
          (r) => r.status === "no_url"
        ).length;
        const status404Count = validationResult.results.filter(
          (r) => r.status === "404"
        ).length;

        logger.info(`[VALIDATION] Summary Statistics:`, {
          total: validationResult.results.length,
          valid: validCount,
          invalid: invalidCount,
          noUrl: noUrlCount,
          status404: status404Count,
        });

        // Log first 10 validation results for inspection
        const resultsToLog = validationResult.results.slice(0, 10);
        resultsToLog.forEach((result, index) => {
          logger.info(
            `[VALIDATION] Result ${index + 1}/${resultsToLog.length}:`,
            {
              fixtureId: result.fixtureId || "N/A",
              gameID: result.gameID || "N/A",
              valid: result.valid,
              status: result.status || "N/A",
              url: result.url || "N/A",
              httpStatus: result.httpStatus || "N/A",
            }
          );
        });

        if (validationResult.results.length > 10) {
          logger.info(
            `[VALIDATION] ... and ${
              validationResult.results.length - 10
            } more validation results`
          );
        }

        // Log invalid fixtures specifically
        const invalidResults = validationResult.results.filter(
          (r) => r.valid === false
        );
        if (invalidResults.length > 0) {
          logger.info(
            `[VALIDATION] Found ${invalidResults.length} invalid fixtures:`,
            {
              invalidFixtures: invalidResults.slice(0, 5).map((r) => ({
                fixtureId: r.fixtureId,
                gameID: r.gameID,
                status: r.status,
                url: r.url,
              })),
            }
          );
        }
      } else {
        logger.warn("[VALIDATION] No validation results found:", {
          validationResult: validationResult,
        });
      }

      // MEMORY TRACKING: Log final state
      const validationFinalMemory = getMemoryStats();
      logger.info("[VALIDATION] Fixture validation complete", {
        fixturesFound: validationResult.fixtures?.length || 0,
        validated: validationResult.validated || 0,
        valid: validationResult.valid || 0,
        invalid: validationResult.invalid || 0,
        accountId: dataObj.ACCOUNT.ACCOUNTID,
        memory: {
          initial: {
            rss: `${Math.round(validationInitialMemory.rss)}MB`,
            heapUsed: `${Math.round(validationInitialMemory.heapUsed)}MB`,
          },
          final: {
            rss: `${Math.round(validationFinalMemory.rss)}MB`,
            heapUsed: `${Math.round(validationFinalMemory.heapUsed)}MB`,
          },
          delta: {
            rss: `+${Math.round(
              validationFinalMemory.rss - validationInitialMemory.rss
            )}MB`,
            heapUsed: `+${Math.round(
              validationFinalMemory.heapUsed - validationInitialMemory.heapUsed
            )}MB`,
          },
        },
      });
      logger.info("[VALIDATION] ===== END VALIDATION RESULTS LOG =====");

      return {
        results: validationResult.results || [],
        fixtures: validationResult.fixtures || [],
      };
    } catch (error) {
      logger.error("[VALIDATION] Error in ProcessFixtureValidation:", error);

      // Don't throw error - allow cleanup to proceed even if validation fails
      logger.warn(
        "[VALIDATION] Fixture validation failed, continuing with cleanup (if enabled)",
        {
          method: "ProcessFixtureValidation",
          class: "DataController",
          error: error.message,
        }
      );
      return {
        results: [],
        fixtures: [],
      };
    }
  }
}

module.exports = FixtureValidationProcessorComponent;

