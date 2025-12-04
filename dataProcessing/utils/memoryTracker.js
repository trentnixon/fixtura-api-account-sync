const logger = require("../../src/utils/logger");

class MemoryTracker {
  constructor(interval = 20000) {
    this.peakMemoryUsage = 0;
    this.intervalId = null;
    this.interval = interval;
    this.memoryThresholdMB = parseInt(
      process.env.MEMORY_THRESHOLD_MB || "1800",
      10
    ); // Default 1.8GB warning threshold
    this.memoryCriticalMB = parseInt(
      process.env.MEMORY_CRITICAL_MB || "1900",
      10
    ); // Default 1.9GB critical threshold
    this.lastMemoryLog = null;
  }

  /**
   * Get current memory stats
   * @returns {object} Memory statistics in MB
   */
  getMemoryStats() {
    const memoryUsage = process.memoryUsage();
    return {
      rss: memoryUsage.rss / 1024 / 1024, // Resident Set Size (total allocated)
      heapTotal: memoryUsage.heapTotal / 1024 / 1024,
      heapUsed: memoryUsage.heapUsed / 1024 / 1024,
      external: memoryUsage.external / 1024 / 1024,
      arrayBuffers: memoryUsage.arrayBuffers / 1024 / 1024,
    };
  }

  /**
   * Log memory stats with threshold warnings
   * @param {string} context - Context for logging (e.g., "category-1", "batch-5")
   */
  logMemoryStats(context = "") {
    const stats = this.getMemoryStats();
    const totalMemoryMB = stats.rss;
    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, totalMemoryMB);

    const memoryUsageInfo = Object.entries(stats)
      .map(([key, value]) => `${key}: ${value.toFixed(2)} MB`)
      .join(", ");

    const contextPrefix = context ? `[${context}] ` : "";

    // Log at info level if above threshold, debug otherwise
    if (totalMemoryMB >= this.memoryCriticalMB) {
      logger.critical(
        `${contextPrefix}MEMORY CRITICAL: ${memoryUsageInfo} (Peak: ${this.peakMemoryUsage.toFixed(
          2
        )} MB)`
      );
    } else if (totalMemoryMB >= this.memoryThresholdMB) {
      logger.warn(
        `${contextPrefix}MEMORY WARNING: ${memoryUsageInfo} (Peak: ${this.peakMemoryUsage.toFixed(
          2
        )} MB)`
      );
    } else {
      logger.info(
        `${contextPrefix}Memory Usage: ${memoryUsageInfo} (Peak: ${this.peakMemoryUsage.toFixed(
          2
        )} MB)`
      );
    }

    this.lastMemoryLog = { stats, context, timestamp: Date.now() };
    return stats;
  }

  /**
   * Get the last memory log
   * @returns {object|null} Last memory log or null
   */
  getLastMemoryLog() {
    return this.lastMemoryLog;
  }

  startTracking() {
    try {
      this.intervalId = setInterval(() => {
        this.logMemoryStats("MEMORY_TRACKER");
      }, this.interval);
    } catch (error) {
      logger.error("Error occurred in MemoryTracker.startTracking", {
        file: "memoryTracker.js",
        function: "startTracking",
        error: error.message,
      });
    }
  }

  stopTracking() {
    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    } catch (error) {
      logger.error("Error occurred in MemoryTracker.stopTracking", {
        file: "memoryTracker.js",
        function: "stopTracking",
        error: error.message,
      });
    }
  }

  getPeakUsage() {
    try {
      return this.peakMemoryUsage;
    } catch (error) {
      logger.error("Error occurred in MemoryTracker.getPeakUsage", {
        file: "memoryTracker.js",
        function: "getPeakUsage",
        error: error.message,
      });
      // Optionally return a default value or rethrow the error
      throw error;
    }
  }

  /**
   * Check if memory is above threshold
   * @returns {boolean} True if memory is above warning threshold
   */
  isMemoryHigh() {
    const stats = this.getMemoryStats();
    return stats.rss >= this.memoryThresholdMB;
  }

  /**
   * Check if memory is critical
   * @returns {boolean} True if memory is above critical threshold
   */
  isMemoryCritical() {
    const stats = this.getMemoryStats();
    return stats.rss >= this.memoryCriticalMB;
  }
}

module.exports = MemoryTracker;
