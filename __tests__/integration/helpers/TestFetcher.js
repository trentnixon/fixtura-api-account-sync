/**
 * Test Fetcher Wrapper
 * Provides read-only access to production scrapers while blocking CMS writes
 */

const logger = require("../../../src/utils/logger");

class TestFetcher {
  constructor(realFetcher) {
    this.realFetcher = realFetcher;
    this.blockedOperations = [];
    this.mockResponses = new Map();
    this.readOperations = [];

    // Initialize mock responses for common operations
    this.initializeMockResponses();
  }

  /**
   * Initialize mock responses for common CMS operations
   */
  initializeMockResponses() {
    // Mock data collection responses
    this.mockResponses.set("data-collections-POST", {
      id: "test-collection-123",
      data: {
        accountId: "test-account",
        status: "processing",
        createdAt: new Date().toISOString(),
      },
    });

    // Mock competition responses
    this.mockResponses.set("competitions-POST", {
      id: "test-competition-456",
      data: {
        name: "Test Competition",
        grade: 1234,
        status: "active",
      },
    });

    // Mock team responses
    this.mockResponses.set("teams-POST", {
      id: "test-team-789",
      data: {
        name: "Test Team",
        grade: 1234,
        status: "active",
      },
    });

    // Mock game data responses
    this.mockResponses.set("game-data-POST", {
      id: "test-game-101",
      data: {
        date: "2024-01-01",
        status: "scheduled",
        teams: ["team1", "team2"],
      },
    });
  }

  /**
   * Main fetch method that handles read/write operations
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Response data
   */
  async fetch(path, method = "GET", body = {}) {
    // Validate test environment
    this.validateTestEnvironment();

    if (method === "GET") {
      // Allow read operations
      this.readOperations.push({ path, method, body, timestamp: new Date() });
      logger.info(`[TestFetcher] Allowing read operation: ${method} ${path}`);

      try {
        return await this.realFetcher(path, method, body);
      } catch (error) {
        logger.warn(`[TestFetcher] Read operation failed: ${error.message}`);
        // Return mock data for failed reads in test environment
        return this.getMockReadResponse(path);
      }
    } else {
      // Block write operations
      this.blockWriteOperation(path, method, body);
      return this.getMockWriteResponse(path, method);
    }
  }

  /**
   * Block write operation and log it
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {Object} body - Request body
   */
  blockWriteOperation(path, method, body) {
    const operation = {
      path,
      method,
      body,
      timestamp: new Date(),
      blocked: true,
    };

    this.blockedOperations.push(operation);
    logger.info(`[TestFetcher] Blocked write operation: ${method} ${path}`);
  }

  /**
   * Get mock response for write operations
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @returns {Object} Mock response
   */
  getMockWriteResponse(path, method) {
    const key = `${path}-${method}`;

    if (this.mockResponses.has(key)) {
      return this.mockResponses.get(key);
    }

    // Default mock response
    return {
      id: `test-${Date.now()}`,
      data: {
        path,
        method,
        status: "mocked",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get mock response for failed read operations
   * @param {string} path - API path
   * @returns {Object} Mock response
   */
  getMockReadResponse(path) {
    // Return appropriate mock data based on path
    if (path.includes("accounts/")) {
      return {
        id: "test-account-123",
        attributes: {
          name: "Test Account",
          type: "club",
          status: "active",
        },
      };
    }

    if (path.includes("clubs/")) {
      return {
        id: "test-club-456",
        attributes: {
          name: "Test Club",
          href: "/test-club-url",
          competitions: { data: [] },
          teams: { data: [] },
        },
      };
    }

    if (path.includes("associations/")) {
      return {
        id: "test-association-789",
        attributes: {
          name: "Test Association",
          clubs: { data: [] },
          competitions: { data: [] },
        },
      };
    }

    // Default mock response
    return {
      data: [],
      meta: {
        pagination: {
          page: 1,
          pageSize: 25,
          total: 0,
        },
      },
    };
  }

  /**
   * Validate test environment
   */
  validateTestEnvironment() {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("TestFetcher can only be used in test environment");
    }

    if (process.env.READ_ONLY_MODE !== "true") {
      throw new Error("TestFetcher requires READ_ONLY_MODE=true");
    }
  }

  /**
   * Get blocked operations for validation
   * @returns {Array} Array of blocked operations
   */
  getBlockedOperations() {
    return this.blockedOperations;
  }

  /**
   * Get read operations for validation
   * @returns {Array} Array of read operations
   */
  getReadOperations() {
    return this.readOperations;
  }

  /**
   * Clear operation logs
   */
  clearLogs() {
    this.blockedOperations = [];
    this.readOperations = [];
  }

  /**
   * Add custom mock response
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {Object} response - Mock response
   */
  addMockResponse(path, method, response) {
    const key = `${path}-${method}`;
    this.mockResponses.set(key, response);
  }

  /**
   * Get operation statistics
   * @returns {Object} Operation statistics
   */
  getStatistics() {
    return {
      totalOperations:
        this.blockedOperations.length + this.readOperations.length,
      blockedOperations: this.blockedOperations.length,
      readOperations: this.readOperations.length,
      blockedMethods: this.blockedOperations.reduce((acc, op) => {
        acc[op.method] = (acc[op.method] || 0) + 1;
        return acc;
      }, {}),
      readPaths: this.readOperations.map((op) => op.path),
      blockedPaths: this.blockedOperations.map((op) => op.path),
    };
  }

  /**
   * Validate no write operations occurred
   * @returns {boolean} True if no write operations
   */
  validateNoWrites() {
    const hasWrites = this.blockedOperations.length > 0;
    if (hasWrites) {
      logger.error(
        `[TestFetcher] Write operations detected: ${this.blockedOperations.length}`
      );
      this.blockedOperations.forEach((op) => {
        logger.error(`[TestFetcher] Blocked: ${op.method} ${op.path}`);
      });
    }
    return !hasWrites;
  }
}

module.exports = TestFetcher;
