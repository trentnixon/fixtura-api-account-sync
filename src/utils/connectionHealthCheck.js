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
      // Get health check endpoint from environment variable
      // If not set, skip the check to avoid 404 errors
      const healthCheckPath = process.env.HEALTH_CHECK_PATH;

      if (!healthCheckPath || healthCheckPath.trim() === "") {
        // No endpoint configured - skip check to avoid 404 errors
        logger.debug(
          "Health check path not configured (HEALTH_CHECK_PATH), skipping health check"
        );
        // Mark as healthy by default if no endpoint configured (assume API is up)
        this.isHealthy = true;
        this.lastError = null;
        this.lastCheck = new Date();
        return true;
      }

      logger.info("Checking API connection health...", {
        endpoint: healthCheckPath,
      });

      // Try to fetch the configured health check endpoint
      const response = await fetcher(healthCheckPath, "GET", {}, 1); // Reduced retries for health check

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
      // Log error but don't crash - health check failure shouldn't stop the app
      this.isHealthy = false;
      this.lastError = error.message;
      this.lastCheck = new Date();
      logger.error("API connection health check failed (non-critical):", {
        error: error.message,
        endpoint: process.env.HEALTH_CHECK_PATH || "not configured",
      });
      // Return false but don't throw - health check is informational only
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
