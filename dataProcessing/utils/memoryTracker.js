const logger = require("../../src/utils/logger");

class MemoryTracker {
  constructor(interval = 20000) {
    this.peakMemoryUsage = 0;
    this.intervalId = null;
    this.interval = interval;
  }

  startTracking() {
    try {
      this.intervalId = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const totalMemoryMB = memoryUsage.rss / 1024 / 1024;
        this.peakMemoryUsage = Math.max(this.peakMemoryUsage, totalMemoryMB);

        const memoryUsageInfo = Object.entries(memoryUsage)
          .map(
            ([key, value]) => `${key}: ${(value / 1024 / 1024).toFixed(2)} MB`
          )
          .join(", ");

        logger.debug(`Memory Usage: ${memoryUsageInfo}`);
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
}

module.exports = MemoryTracker;
