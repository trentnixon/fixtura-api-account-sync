/**
 * MemoryMonitor - Handles memory monitoring and restart decision logic
 * Extracted from PuppeteerManager for better separation of concerns
 */

const logger = require("../../../src/utils/logger");
const { getMemoryStats, formatMemoryStats } = require("../memoryUtils");
const { MEMORY_CONFIG } = require("../constants");

class MemoryMonitor {
  constructor() {
    this.operationCount = 0;
    this.maxOperationsBeforeRestart =
      MEMORY_CONFIG.MAX_OPERATIONS_BEFORE_RESTART;
    this.lastRestartTime = Date.now();
    this.minRestartInterval = MEMORY_CONFIG.MIN_RESTART_INTERVAL;
  }

  /**
   * Increment operation count
   * Called whenever a new page is created or operation is performed
   */
  incrementOperationCount() {
    this.operationCount++;
  }

  /**
   * Reset operation count and update last restart time
   * Called after browser restart
   */
  resetAfterRestart() {
    this.operationCount = 0;
    this.lastRestartTime = Date.now();
  }

  /**
   * Check if restart is needed based on operation count and memory thresholds
   * @param {Function} restartCallback - Callback to execute if restart is needed
   * @returns {Promise<boolean>} True if restart was triggered, false otherwise
   */
  async checkAndRestartIfNeeded(restartCallback) {
    const now = Date.now();
    const timeSinceLastRestart = now - this.lastRestartTime;

    // Don't restart too frequently (rate limiting) - fast check first
    if (timeSinceLastRestart < this.minRestartInterval) {
      return false;
    }

    // Fast check: Restart if we've exceeded operation count (no memory check needed)
    if (this.operationCount >= this.maxOperationsBeforeRestart) {
      logger.info(
        `[MemoryMonitor] Restarting browser after ${this.operationCount} operations to free memory`
      );
      if (restartCallback) {
        await restartCallback();
        this.resetAfterRestart();
      }
      return true;
    }

    // Only do expensive memory check if we're close to operation limit or it's time to log
    // This avoids expensive getMemoryStats() calls on every page creation
    const opsUntilRestart =
      this.maxOperationsBeforeRestart - this.operationCount;
    const shouldCheckMemory =
      opsUntilRestart <= 10 || // Close to restart limit
      this.operationCount % MEMORY_CONFIG.MEMORY_CHECK_INTERVAL === 0; // Time to log

    if (shouldCheckMemory) {
      const stats = getMemoryStats();
      const shouldLogMemory =
        this.operationCount % MEMORY_CONFIG.MEMORY_CHECK_INTERVAL === 0 ||
        stats.heapUsed > MEMORY_CONFIG.MEMORY_WARNING_HEAP_MB ||
        stats.rss > MEMORY_CONFIG.MEMORY_WARNING_RSS_MB;

      if (shouldLogMemory) {
        logger.info(
          `[MemoryMonitor] Memory check: ${formatMemoryStats(stats)}, Ops=${
            this.operationCount
          }`
        );
      }
    }

    return false;
  }

  /**
   * Temporarily disable rate limiting for forced restart
   * @returns {number} Original minRestartInterval value
   */
  disableRateLimiting() {
    const originalMinInterval = this.minRestartInterval;
    this.minRestartInterval = 0;
    return originalMinInterval;
  }

  /**
   * Restore rate limiting after forced restart
   * @param {number} originalMinInterval - Original minRestartInterval value
   */
  restoreRateLimiting(originalMinInterval) {
    this.minRestartInterval = originalMinInterval;
  }

  /**
   * Get current memory usage statistics with operation count
   * @returns {Object} Memory statistics including operation count
   */
  getMemoryStats() {
    const stats = getMemoryStats();
    return {
      rss: stats.rss.toFixed(2) + " MB",
      heapTotal: stats.heapTotal.toFixed(2) + " MB",
      heapUsed: stats.heapUsed.toFixed(2) + " MB",
      external: stats.external.toFixed(2) + " MB",
      operationCount: this.operationCount,
    };
  }

  /**
   * Get operation count
   * @returns {number} Current operation count
   */
  getOperationCount() {
    return this.operationCount;
  }

  /**
   * Check if it's time to log memory (based on operation count interval)
   * @returns {boolean} True if memory should be logged
   */
  shouldLogMemory() {
    return this.operationCount % MEMORY_CONFIG.MEMORY_LOG_INTERVAL === 0;
  }
}

module.exports = MemoryMonitor;
