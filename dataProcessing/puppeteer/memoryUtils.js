/**
 * Memory Utilities
 * Helper functions for memory management and formatting
 */

const MB_CONVERSION = 1024 * 1024;

/**
 * Convert bytes to megabytes
 * @param {number} bytes - Bytes to convert
 * @returns {number} Megabytes
 */
const bytesToMB = (bytes) => {
  return bytes / MB_CONVERSION;
};

/**
 * Format bytes as MB string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string (e.g., "123.45 MB")
 */
const formatMemoryMB = (bytes) => {
  return `${bytesToMB(bytes).toFixed(2)} MB`;
};

/**
 * Get memory usage statistics
 * @returns {Object} Memory statistics in MB
 */
const getMemoryStats = () => {
  const mem = process.memoryUsage();
  return {
    rss: bytesToMB(mem.rss),
    heapTotal: bytesToMB(mem.heapTotal),
    heapUsed: bytesToMB(mem.heapUsed),
    external: bytesToMB(mem.external),
  };
};

/**
 * Format memory statistics for logging
 * @param {Object} stats - Memory statistics object
 * @returns {string} Formatted string
 */
const formatMemoryStats = (stats) => {
  return `RSS=${stats.rss.toFixed(2)}MB, Heap=${stats.heapUsed.toFixed(
    2
  )}MB/${stats.heapTotal.toFixed(2)}MB, External=${stats.external.toFixed(
    2
  )}MB`;
};

module.exports = {
  bytesToMB,
  formatMemoryMB,
  getMemoryStats,
  formatMemoryStats,
};
