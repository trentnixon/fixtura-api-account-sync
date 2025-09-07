const fetcher = require("./fetcher");
const logger = require("./logger");

class ConnectionHealthCheck {
  constructor() {
    this.lastCheck = null;
    this.isHealthy = false;
    this.lastError = null;
  }

  /**
   * Check if the API connection is healthy
   * @returns {Promise<boolean>} Connection health status
   */
  async checkHealth() {
    try {
      logger.info("Checking API connection health...");

      // Try to fetch a simple endpoint to test connectivity
      const response = await fetcher("", "GET", {}, 1); // Reduced retries for health check

      if (response !== null) {
        this.isHealthy = true;
        this.lastError = null;
        this.lastCheck = new Date();
        logger.info("API connection is healthy");
        return true;
      } else {
        this.isHealthy = false;
        this.lastError = "Fetcher returned null";
        this.lastCheck = new Date();
        logger.warn("API connection is unhealthy: Fetcher returned null");
        return false;
      }
    } catch (error) {
      this.isHealthy = false;
      this.lastError = error.message;
      this.lastCheck = new Date();
      logger.error("API connection health check failed:", error);
      return false;
    }
  }

  /**
   * Get connection status information
   * @returns {Object} Connection status details
   */
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastCheck,
      lastError: this.lastError,
      apiUrl: process.env.FIXTURA_API || "http://127.0.0.1:1337",
      environment: process.env.NODE_ENV || "unknown",
    };
  }

  /**
   * Log connection status for debugging
   */
  logStatus() {
    const status = this.getStatus();
    logger.info("Connection Status:", status);

    if (!status.isHealthy) {
      logger.warn("API connection issues detected. Please check:");
      logger.warn(`1. API server is running at: ${status.apiUrl}`);
      logger.warn(`2. Environment variables are properly set`);
      logger.warn(`3. Network connectivity to the API server`);
      if (status.lastError) {
        logger.warn(`4. Last error: ${status.lastError}`);
      }
    }
  }

  /**
   * Wait for connection to become healthy with timeout
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {number} checkIntervalMs - Interval between checks
   * @returns {Promise<boolean>} True if connection becomes healthy, false if timeout
   */
  async waitForHealthy(timeoutMs = 60000, checkIntervalMs = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.checkHealth()) {
        return true;
      }

      logger.info(
        `Waiting for API connection to become healthy... (${Math.round(
          (timeoutMs - (Date.now() - startTime)) / 1000
        )}s remaining)`
      );
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }

    logger.error("Timeout waiting for API connection to become healthy");
    return false;
  }
}

module.exports = ConnectionHealthCheck;
