/**
 * Test Environment Setup
 * Configures the test environment with read-only CMS access
 */

const TestFetcher = require("./TestFetcher");
const logger = require("../../../src/utils/logger");

class TestEnvironment {
  constructor() {
    this.originalFetcher = null;
    this.testFetcher = null;
    this.isSetup = false;
  }

  /**
   * Setup test environment with read-only CMS access
   */
  async setup() {
    if (this.isSetup) {
      logger.warn("[TestEnvironment] Already setup, skipping");
      return;
    }

    try {
      // Set test environment variables
      process.env.NODE_ENV = "test";
      process.env.READ_ONLY_MODE = "true";

      // Store original fetcher
      this.originalFetcher = require("../../../src/utils/fetcher");

      // Create test fetcher wrapper
      this.testFetcher = new TestFetcher(this.originalFetcher);

      // Replace the fetcher module
      const fetcherModule =
        require.cache[require.resolve("../../../src/utils/fetcher")];
      if (fetcherModule) {
        fetcherModule.exports = this.testFetcher.fetch.bind(this.testFetcher);
      }

      this.isSetup = true;
      logger.info(
        "[TestEnvironment] Test environment setup complete - read-only mode enabled"
      );
    } catch (error) {
      logger.error("[TestEnvironment] Failed to setup test environment", {
        error,
      });
      throw error;
    }
  }

  /**
   * Teardown test environment and restore original fetcher
   */
  async teardown() {
    if (!this.isSetup) {
      return;
    }

    try {
      // Restore original fetcher
      if (this.originalFetcher) {
        const fetcherModule =
          require.cache[require.resolve("../../../src/utils/fetcher")];
        if (fetcherModule) {
          fetcherModule.exports = this.originalFetcher;
        }
      }

      // Clear environment variables
      delete process.env.NODE_ENV;
      delete process.env.READ_ONLY_MODE;

      this.isSetup = false;
      logger.info("[TestEnvironment] Test environment teardown complete");
    } catch (error) {
      logger.error("[TestEnvironment] Failed to teardown test environment", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get test fetcher statistics
   */
  getStatistics() {
    if (!this.testFetcher) {
      return null;
    }
    return this.testFetcher.getStatistics();
  }

  /**
   * Get blocked operations
   */
  getBlockedOperations() {
    if (!this.testFetcher) {
      return [];
    }
    return this.testFetcher.getBlockedOperations();
  }

  /**
   * Get read operations
   */
  getReadOperations() {
    if (!this.testFetcher) {
      return [];
    }
    return this.testFetcher.getReadOperations();
  }

  /**
   * Validate no write operations occurred
   */
  validateNoWrites() {
    if (!this.testFetcher) {
      return true;
    }
    return this.testFetcher.validateNoWrites();
  }

  /**
   * Clear operation logs
   */
  clearLogs() {
    if (this.testFetcher) {
      this.testFetcher.clearLogs();
    }
  }

  /**
   * Add custom mock response
   */
  addMockResponse(path, method, response) {
    if (this.testFetcher) {
      this.testFetcher.addMockResponse(path, method, response);
    }
  }
}

module.exports = TestEnvironment;
