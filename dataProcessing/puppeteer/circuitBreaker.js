/**
 * Circuit Breaker Pattern for Proxy Failures
 * Prevents cascading failures when proxy is down or repeatedly failing
 */

const logger = require("../../src/utils/logger");

class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * @param {number} threshold - Number of consecutive failures before opening circuit (default: 5)
   * @param {number} timeout - Timeout in milliseconds before attempting half-open (default: 60000 = 60 seconds)
   */
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.successCount = 0;
    this.threshold = threshold; // Open after N consecutive failures
    this.timeout = timeout; // Wait time before attempting half-open state
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
  }

  /**
   * Execute an operation through the circuit breaker
   * @param {Function} operation - Async function to execute
   * @returns {Promise<any>} Result of the operation
   * @throws {Error} If circuit is OPEN and timeout hasn't passed
   */
  async execute(operation) {
    // If circuit is OPEN, check if we can try half-open state
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttempt) {
        const waitTime = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new Error(
          `Circuit breaker is OPEN - proxy appears to be down. Retry in ${waitTime}s`
        );
      }
      // Timeout has passed, try half-open state
      this.state = "HALF_OPEN";
      logger.info(
        "[CircuitBreaker] Attempting half-open state - testing if proxy recovered"
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   * Resets failure count and closes circuit if in half-open state
   */
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === "HALF_OPEN") {
      // Successfully recovered - close the circuit
      this.state = "CLOSED";
      this.nextAttempt = null;
      logger.info(
        "[CircuitBreaker] Circuit breaker CLOSED - proxy recovered successfully",
        {
          successCount: this.successCount,
        }
      );
    }
  }

  /**
   * Handle failed operation
   * Increments failure count and opens circuit if threshold reached
   */
  onFailure() {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      logger.error(
        `[CircuitBreaker] Circuit breaker OPEN - ${this.failureCount} consecutive failures`,
        {
          failureCount: this.failureCount,
          threshold: this.threshold,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          timeoutSeconds: this.timeout / 1000,
        }
      );
    } else {
      logger.debug(
        `[CircuitBreaker] Failure count: ${this.failureCount}/${this.threshold}`,
        {
          failureCount: this.failureCount,
          threshold: this.threshold,
          state: this.state,
        }
      );
    }
  }

  /**
   * Reset circuit breaker to CLOSED state
   * Useful for manual recovery or testing
   */
  reset() {
    const previousState = this.state;
    this.failureCount = 0;
    this.successCount = 0;
    this.state = "CLOSED";
    this.nextAttempt = null;
    logger.info("[CircuitBreaker] Circuit breaker reset", {
      previousState,
    });
  }

  /**
   * Get current circuit breaker state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      threshold: this.threshold,
      nextAttempt: this.nextAttempt
        ? new Date(this.nextAttempt).toISOString()
        : null,
      isOpen: this.state === "OPEN",
      canAttempt: this.state === "OPEN" && Date.now() >= this.nextAttempt,
    };
  }
}

module.exports = CircuitBreaker;

