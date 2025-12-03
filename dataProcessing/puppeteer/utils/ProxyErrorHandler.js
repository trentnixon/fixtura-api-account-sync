/**
 * ProxyErrorHandler - Handles proxy-related errors and rate limit detection
 * Extracted from PuppeteerManager for better separation of concerns
 */

const logger = require("../../../src/utils/logger");
const OperationContext = require("../../utils/OperationContext");

class ProxyErrorHandler {
  constructor(circuitBreaker, proxyConfigManager, pagePool = null) {
    this.circuitBreaker = circuitBreaker;
    this.proxyConfigManager = proxyConfigManager;
    this.pagePool = pagePool; // Reference to page pool for removing problematic pages
    this.proxyRateLimitDetected = false;
    this.rateLimitBackoffUntil = null;
    this.consecutiveRateLimitErrors = 0;
  }

  /**
   * Set page pool reference (needed for removing problematic pages)
   * @param {Array} pagePool - Reference to page pool array
   */
  setPagePool(pagePool) {
    this.pagePool = pagePool;
  }

  /**
   * Handle proxy-related errors and detect rate limits
   * Detects HTTP 429 (rate limit) errors and implements exponential backoff
   * Also tracks failures for circuit breaker
   * @param {Error} error - The error that occurred
   * @param {Page} page - Optional page instance (for removing from pool if needed)
   * @param {Object} context - Optional operation context for better error messages
   */
  handleError(error, page = null, context = null) {
    const errorMessage = error.message || "";
    const ctx =
      context ||
      new OperationContext("proxyError", "puppeteer", {
        pageUrl: page ? page.url() : null,
        pageClosed: page ? page.isClosed() : null,
      });

    // Check if this is a proxy connection failure (for circuit breaker)
    const isProxyConnectionFailure =
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("net::ERR_PROXY_CONNECTION_FAILED") ||
      errorMessage.includes("net::ERR_TUNNEL_CONNECTION_FAILED");

    if (isProxyConnectionFailure) {
      // Record failure for circuit breaker
      this.circuitBreaker.onFailure();
      const proxyConfig = this.proxyConfigManager.getConfig();
      ctx.warn(
        "[ProxyErrorHandler] Proxy connection failure detected, circuit breaker tracking",
        {
          error: errorMessage,
          circuitState: this.circuitBreaker.getState(),
          proxyConfig: proxyConfig
            ? {
                host: proxyConfig.host,
                port: proxyConfig.port,
              }
            : null,
        }
      );
    }

    // Detect HTTP 429 rate limit errors
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      this.consecutiveRateLimitErrors++;
      this.proxyRateLimitDetected = true;

      // Exponential backoff: 2^errors minutes (max 60 minutes)
      // 1st error: 2 minutes, 2nd: 4 minutes, 3rd: 8 minutes, etc.
      const backoffMinutes = Math.min(
        Math.pow(2, this.consecutiveRateLimitErrors),
        60
      );
      this.rateLimitBackoffUntil = Date.now() + backoffMinutes * 60 * 1000;

      const proxyConfig = this.proxyConfigManager.getConfig();
      ctx.error(
        `[ProxyErrorHandler] Proxy rate limit detected (${this.consecutiveRateLimitErrors} consecutive), backing off for ${backoffMinutes} minutes`,
        error,
        {
          consecutiveErrors: this.consecutiveRateLimitErrors,
          backoffMinutes,
          backoffUntil: new Date(this.rateLimitBackoffUntil).toISOString(),
          proxyConfig: proxyConfig
            ? {
                host: proxyConfig.host,
                port: proxyConfig.port,
              }
            : null,
        }
      );

      // Remove problematic page from pool if provided
      if (page && this.pagePool) {
        const index = this.pagePool.indexOf(page);
        if (index > -1) {
          this.pagePool.splice(index, 1);
          logger.debug(
            "[ProxyErrorHandler] Removed page from pool due to rate limit"
          );
        }
      }
    } else if (errorMessage.includes("407")) {
      // Proxy authentication error - different handling
      const proxyConfig = this.proxyConfigManager.getConfig();
      ctx.error(
        "[ProxyErrorHandler] Proxy authentication failed (407)",
        error,
        {
          proxyConfig: proxyConfig
            ? {
                host: proxyConfig.host,
                port: proxyConfig.port,
                hasUsername: !!proxyConfig.username,
                hasPassword: !!proxyConfig.password,
              }
            : null,
        }
      );
      // Don't increment rate limit counter for auth errors
    }
  }

  /**
   * Reset rate limit state after successful operations
   * Call this after successful navigation/operations to clear rate limit state
   * Also records success for circuit breaker
   */
  resetRateLimitState() {
    // Record success for circuit breaker
    this.circuitBreaker.onSuccess();

    if (this.consecutiveRateLimitErrors > 0) {
      logger.info(
        "[ProxyErrorHandler] Rate limit state reset after successful operations",
        {
          previousConsecutiveErrors: this.consecutiveRateLimitErrors,
        }
      );
      this.consecutiveRateLimitErrors = 0;
      this.proxyRateLimitDetected = false;
      this.rateLimitBackoffUntil = null;
    }
  }

  /**
   * Check if we're currently in a rate limit backoff period
   * @returns {boolean} True if backoff is active
   */
  isInBackoff() {
    return (
      this.rateLimitBackoffUntil !== null &&
      Date.now() < this.rateLimitBackoffUntil
    );
  }

  /**
   * Get remaining backoff time in seconds
   * @returns {number} Remaining seconds, or 0 if not in backoff
   */
  getRemainingBackoffSeconds() {
    if (!this.isInBackoff()) {
      return 0;
    }
    return Math.ceil((this.rateLimitBackoffUntil - Date.now()) / 1000);
  }

  /**
   * Wait for backoff period to complete (if active)
   * @returns {Promise<void>}
   */
  async waitForBackoff() {
    if (this.isInBackoff()) {
      const waitTime = this.getRemainingBackoffSeconds();
      logger.warn(
        `[ProxyErrorHandler] Rate limit backoff active, waiting ${waitTime}s before proceeding`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitBackoffUntil - Date.now())
      );
    }
  }

  /**
   * Get current rate limit state
   * @returns {Object} Rate limit state information
   */
  getRateLimitState() {
    return {
      proxyRateLimitDetected: this.proxyRateLimitDetected,
      rateLimitBackoffUntil: this.rateLimitBackoffUntil
        ? new Date(this.rateLimitBackoffUntil).toISOString()
        : null,
      consecutiveRateLimitErrors: this.consecutiveRateLimitErrors,
      isInBackoff: this.isInBackoff(),
      remainingBackoffSeconds: this.getRemainingBackoffSeconds(),
    };
  }
}

module.exports = ProxyErrorHandler;
