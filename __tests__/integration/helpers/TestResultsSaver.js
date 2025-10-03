/**
 * Test Results Saver
 * Saves scraper test results to Strapi CMS for validation and regression testing
 */

const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");

class TestResultsSaver {
  constructor() {
    this.collectionName = "fetch-test-accounts";
  }

  /**
   * Save test results to Strapi
   * @param {Object} testData - Test result data
   * @returns {Promise<Object>} Saved result
   */
  async saveTestResult(testData) {
    try {
      const payload = this.buildPayload(testData);

      logger.info(
        `[TestResultsSaver] Saving test result to Strapi: ${testData.scraperType}`
      );

      const result = await fetcher(this.collectionName, "POST", {
        data: payload,
      });

      logger.info(
        `[TestResultsSaver] Test result saved successfully with ID: ${result.id}`
      );

      return result;
    } catch (error) {
      logger.error(
        `[TestResultsSaver] Error saving test result: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Build payload for Strapi
   * @param {Object} testData - Test data
   * @returns {Object} Strapi payload
   */
  buildPayload(testData) {
    return {
      scraperType: testData.scraperType,
      testEntity: testData.testEntity,
      testEntityId: testData.testEntityId,
      testUrl: testData.testUrl,
      expectedData: testData.expectedData,
      actualData: testData.actualData || null,
      overview: this.buildOverview(testData),
      validationResults: testData.validationResults || null,
      timestamp: new Date().toISOString(),
      testDuration: testData.duration || 0,
      testPassed: testData.passed || false,
      totalValidations: testData.totalValidations || 0,
      passedValidations: testData.passedValidations || 0,
      failedValidations: testData.failedValidations || 0,
      testInitiator: testData.testInitiator || "manual",
      errorLogs: testData.errorLogs || null,
      environment: testData.environment || "test",
      performanceMetrics: this.buildPerformanceMetrics(testData),
      scrapedItemCount: testData.scrapedItemCount || 0,
      expectedItemCount: testData.expectedItemCount || 0,
      dataQualityMetrics: this.buildDataQualityMetrics(testData),
      testConfiguration: testData.testConfiguration || null,
      stepResults: testData.stepResults || null,
      comparisonDetails: testData.comparisonDetails || null,
      regressionDetected: testData.regressionDetected || false,
      notes: testData.notes || null,
    };
  }

  /**
   * Build overview section
   * @param {Object} testData - Test data
   * @returns {Object} Overview
   */
  buildOverview(testData) {
    return {
      testName: testData.testName || testData.scraperType,
      status: testData.passed ? "PASSED" : "FAILED",
      duration: testData.duration || 0,
      timestamp: new Date().toISOString(),
      summary: `Scraper: ${testData.scraperType} | Entity: ${
        testData.testEntity
      } | Status: ${testData.passed ? "PASSED" : "FAILED"}`,
    };
  }

  /**
   * Build performance metrics
   * @param {Object} testData - Test data
   * @returns {Object} Performance metrics
   */
  buildPerformanceMetrics(testData) {
    return {
      totalDuration: testData.duration || 0,
      scrapeDuration: testData.scrapeDuration || 0,
      validationDuration: testData.validationDuration || 0,
      itemsPerSecond:
        testData.duration > 0
          ? ((testData.scrapedItemCount || 0) / testData.duration) * 1000
          : 0,
      averageItemDuration:
        testData.scrapedItemCount > 0
          ? testData.duration / testData.scrapedItemCount
          : 0,
    };
  }

  /**
   * Build data quality metrics
   * @param {Object} testData - Test data
   * @returns {Object} Data quality metrics
   */
  buildDataQualityMetrics(testData) {
    const total = testData.totalValidations || 0;
    const passed = testData.passedValidations || 0;

    return {
      validationAccuracy: total > 0 ? (passed / total) * 100 : 0,
      dataCompleteness: testData.dataCompleteness || 100,
      fieldMatchRate: testData.fieldMatchRate || 100,
      structureMatches: testData.structureMatches || true,
    };
  }

  /**
   * Update existing test result
   * @param {string} resultId - Result ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated result
   */
  async updateTestResult(resultId, updateData) {
    try {
      logger.info(`[TestResultsSaver] Updating test result: ${resultId}`);

      const result = await fetcher(
        `${this.collectionName}/${resultId}`,
        "PUT",
        { data: updateData }
      );

      logger.info(`[TestResultsSaver] Test result updated successfully`);

      return result;
    } catch (error) {
      logger.error(
        `[TestResultsSaver] Error updating test result: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get test results by scraper type
   * @param {string} scraperType - Scraper type
   * @returns {Promise<Array>} Test results
   */
  async getTestResultsByType(scraperType) {
    try {
      const results = await fetcher(
        `${this.collectionName}?filters[scraperType][$eq]=${scraperType}&sort=timestamp:desc`
      );

      return results;
    } catch (error) {
      logger.error(
        `[TestResultsSaver] Error fetching test results: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get latest test result for entity
   * @param {string} testEntity - Test entity name
   * @returns {Promise<Object>} Latest test result
   */
  async getLatestTestResult(testEntity) {
    try {
      const results = await fetcher(
        `${this.collectionName}?filters[testEntity][$eq]=${testEntity}&sort=timestamp:desc&pagination[limit]=1`
      );

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error(
        `[TestResultsSaver] Error fetching latest test result: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Build test data from logger report
   * @param {Object} loggerReport - Test logger report
   * @param {Object} additionalData - Additional data
   * @returns {Object} Test data for saving
   */
  buildTestDataFromReport(loggerReport, additionalData = {}) {
    const stepResults = loggerReport.steps || [];
    const validationStep = stepResults.find(
      (s) => s.name === "Validate Data Structure"
    );
    const comparisonStep = stepResults.find(
      (s) => s.name === "Compare with Expected Data"
    );

    return {
      testName: loggerReport.testName,
      scraperType: additionalData.scraperType || "unknown",
      testEntity: additionalData.testEntity || "unknown",
      testEntityId: additionalData.testEntityId || 0,
      testUrl: additionalData.testUrl || "",
      expectedData: additionalData.expectedData || {},
      actualData: additionalData.actualData || {},
      duration: loggerReport.duration || 0,
      passed: loggerReport.passed || false,
      totalValidations: this.countValidations(stepResults),
      passedValidations: this.countPassedValidations(stepResults),
      failedValidations: this.countFailedValidations(stepResults),
      testInitiator: additionalData.testInitiator || "manual",
      environment: process.env.NODE_ENV || "test",
      scrapedItemCount: additionalData.scrapedItemCount || 0,
      expectedItemCount: additionalData.expectedItemCount || 0,
      stepResults: stepResults,
      validationResults: validationStep ? validationStep.result : null,
      comparisonDetails: comparisonStep ? comparisonStep.result : null,
      testConfiguration: additionalData.testConfiguration || {},
      notes: additionalData.notes || null,
    };
  }

  /**
   * Count total validations from step results
   * @param {Array} steps - Step results
   * @returns {number} Total validations
   */
  countValidations(steps) {
    return steps.reduce((count, step) => {
      return (
        count +
        (step.subSteps || []).filter(
          (s) => s.type === "success" || s.type === "error"
        ).length
      );
    }, 0);
  }

  /**
   * Count passed validations
   * @param {Array} steps - Step results
   * @returns {number} Passed validations
   */
  countPassedValidations(steps) {
    return steps.reduce((count, step) => {
      return (
        count + (step.subSteps || []).filter((s) => s.type === "success").length
      );
    }, 0);
  }

  /**
   * Count failed validations
   * @param {Array} steps - Step results
   * @returns {number} Failed validations
   */
  countFailedValidations(steps) {
    return steps.reduce((count, step) => {
      return (
        count + (step.subSteps || []).filter((s) => s.type === "error").length
      );
    }, 0);
  }
}

module.exports = TestResultsSaver;
