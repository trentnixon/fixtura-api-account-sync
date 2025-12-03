/**
 * QueueMetrics - Metrics collection and tracking for Bull queues
 * Tracks queue depth, processing times, success/failure rates, and provides aggregated metrics
 */

const logger = require("../utils/logger");

class QueueMetrics {
  constructor(options = {}) {
    // Configuration
    this.retentionPeriod = options.retentionPeriod || 24 * 60 * 60 * 1000; // 24 hours default
    this.maxHistorySize = options.maxHistorySize || 100; // Keep last 100 snapshots per queue

    // Metrics storage
    this.queueMetrics = new Map(); // queueName -> metrics object
    this.processingTimes = new Map(); // queueName -> array of processing times
    this.jobTracking = new Map(); // jobId -> { queueName, startTime, status }
    this.history = new Map(); // queueName -> array of historical snapshots

    // Success/failure tracking
    this.successCounts = new Map(); // queueName -> count
    this.failureCounts = new Map(); // queueName -> count
  }

  /**
   * Initialize metrics for a queue
   * @param {string} queueName - Name of the queue
   */
  initializeQueue(queueName) {
    if (!this.queueMetrics.has(queueName)) {
      this.queueMetrics.set(queueName, {
        queueName,
        initialized: true,
        firstSeen: Date.now(),
        lastUpdated: null,
      });
      this.processingTimes.set(queueName, []);
      this.successCounts.set(queueName, 0);
      this.failureCounts.set(queueName, 0);
      this.history.set(queueName, []);

      logger.debug(
        `[QueueMetrics] Initialized metrics for queue: ${queueName}`
      );
    }
  }

  /**
   * Track job start time
   * @param {string} queueName - Name of the queue
   * @param {string} jobId - Bull job ID
   */
  trackJobStart(queueName, jobId) {
    this.initializeQueue(queueName);
    this.jobTracking.set(jobId, {
      queueName,
      startTime: Date.now(),
      status: "processing",
    });

    logger.debug(`[QueueMetrics] Tracking job start: ${queueName} - ${jobId}`);
  }

  /**
   * Track job completion
   * @param {string} queueName - Name of the queue
   * @param {string} jobId - Bull job ID
   * @param {boolean} success - Whether job succeeded
   */
  trackJobCompletion(queueName, jobId, success = true) {
    const jobTrack = this.jobTracking.get(jobId);
    if (!jobTrack) {
      logger.warn(
        `[QueueMetrics] Job completion tracked without start: ${queueName} - ${jobId}`
      );
      return;
    }

    const processingTime = Date.now() - jobTrack.startTime;
    const times = this.processingTimes.get(queueName) || [];
    times.push(processingTime);

    // Keep only recent processing times (last maxHistorySize)
    if (times.length > this.maxHistorySize) {
      times.shift();
    }
    this.processingTimes.set(queueName, times);

    // Update success/failure counts
    if (success) {
      const current = this.successCounts.get(queueName) || 0;
      this.successCounts.set(queueName, current + 1);
    } else {
      const current = this.failureCounts.get(queueName) || 0;
      this.failureCounts.set(queueName, current + 1);
    }

    // Remove from active tracking
    this.jobTracking.delete(jobId);

    logger.debug(
      `[QueueMetrics] Job completed: ${queueName} - ${jobId} (${
        success ? "success" : "failure"
      }, ${processingTime}ms)`
    );
  }

  /**
   * Collect queue stats using Bull's getJobCounts() API
   * @param {Queue} queue - Bull queue instance
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Object>} Queue statistics
   */
  async collectQueueStats(queue, queueName) {
    try {
      this.initializeQueue(queueName);

      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();

      // Calculate processing time statistics
      const times = this.processingTimes.get(queueName) || [];
      const processingTimeStats = this.calculateProcessingTimeStats(times);

      // Calculate success/failure rates
      const successCount = this.successCounts.get(queueName) || 0;
      const failureCount = this.failureCounts.get(queueName) || 0;
      const totalProcessed = successCount + failureCount;
      const successRate =
        totalProcessed > 0 ? (successCount / totalProcessed) * 100 : 0;
      const failureRate =
        totalProcessed > 0 ? (failureCount / totalProcessed) * 100 : 0;

      const metrics = {
        queueName,
        timestamp: Date.now(),
        counts: {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
        },
        state: {
          isPaused,
          totalJobs: (counts.waiting || 0) + (counts.active || 0),
        },
        processing: {
          ...processingTimeStats,
          totalProcessed,
          successCount,
          failureCount,
          successRate: parseFloat(successRate.toFixed(2)),
          failureRate: parseFloat(failureRate.toFixed(2)),
        },
      };

      // Update queue metrics
      const queueMetric = this.queueMetrics.get(queueName);
      queueMetric.lastUpdated = Date.now();
      this.queueMetrics.set(queueName, queueMetric);

      // Add to history
      const history = this.history.get(queueName) || [];
      history.push(metrics);
      if (history.length > this.maxHistorySize) {
        history.shift();
      }
      this.history.set(queueName, history);

      return metrics;
    } catch (error) {
      logger.error(`[QueueMetrics] Error collecting stats for ${queueName}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Calculate processing time statistics from array of times
   * @param {Array<number>} times - Array of processing times in milliseconds
   * @returns {Object} Processing time statistics
   */
  calculateProcessingTimeStats(times) {
    if (!times || times.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        count: 0,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((acc, time) => acc + time, 0);
    const average = sum / times.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    return {
      average: parseFloat(average.toFixed(2)),
      min,
      max,
      median: parseFloat(median.toFixed(2)),
      count: times.length,
    };
  }

  /**
   * Calculate processing rate (jobs per minute) from history
   * @param {string} queueName - Name of the queue
   * @param {number} minutes - Number of minutes to look back (default: 5)
   * @returns {number} Processing rate (jobs per minute)
   */
  calculateProcessingRate(queueName, minutes = 5) {
    const history = this.history.get(queueName) || [];
    if (history.length < 2) {
      return 0;
    }

    const cutoffTime = Date.now() - minutes * 60 * 1000;
    const recentSnapshots = history.filter(
      (snapshot) => snapshot.timestamp >= cutoffTime
    );

    if (recentSnapshots.length < 2) {
      return 0;
    }

    const first = recentSnapshots[0];
    const last = recentSnapshots[recentSnapshots.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60; // minutes
    const jobsProcessed =
      last.processing.totalProcessed - first.processing.totalProcessed;

    return timeDiff > 0 ? parseFloat((jobsProcessed / timeDiff).toFixed(2)) : 0;
  }

  /**
   * Aggregate metrics across all queues
   * @returns {Object} Aggregated metrics
   */
  aggregateMetrics() {
    const queues = Array.from(this.queueMetrics.keys());
    const aggregated = {
      timestamp: Date.now(),
      totalQueues: queues.length,
      queues: {},
      system: {
        totalWaiting: 0,
        totalActive: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalProcessed: 0,
        totalSuccess: 0,
        totalFailure: 0,
        averageSuccessRate: 0,
        averageProcessingTime: 0,
      },
    };

    let totalSuccessRate = 0;
    let totalProcessingTime = 0;
    let queuesWithData = 0;

    for (const queueName of queues) {
      const history = this.history.get(queueName) || [];
      const latest = history[history.length - 1];

      if (latest) {
        aggregated.queues[queueName] = {
          ...latest,
          processingRate: this.calculateProcessingRate(queueName),
        };

        // Aggregate system-wide stats
        aggregated.system.totalWaiting += latest.counts.waiting;
        aggregated.system.totalActive += latest.counts.active;
        aggregated.system.totalCompleted += latest.counts.completed;
        aggregated.system.totalFailed += latest.counts.failed;
        aggregated.system.totalProcessed += latest.processing.totalProcessed;
        aggregated.system.totalSuccess += latest.processing.successCount;
        aggregated.system.totalFailure += latest.processing.failureCount;

        if (latest.processing.totalProcessed > 0) {
          totalSuccessRate += latest.processing.successRate;
          totalProcessingTime += latest.processing.average;
          queuesWithData++;
        }
      }
    }

    // Calculate averages
    if (queuesWithData > 0) {
      aggregated.system.averageSuccessRate = parseFloat(
        (totalSuccessRate / queuesWithData).toFixed(2)
      );
      aggregated.system.averageProcessingTime = parseFloat(
        (totalProcessingTime / queuesWithData).toFixed(2)
      );
    }

    return aggregated;
  }

  /**
   * Get metrics for a specific queue
   * @param {string} queueName - Name of the queue
   * @returns {Object|null} Queue metrics or null if not found
   */
  getQueueMetrics(queueName) {
    const history = this.history.get(queueName) || [];
    const latest = history[history.length - 1];
    if (!latest) {
      return null;
    }

    return {
      ...latest,
      processingRate: this.calculateProcessingRate(queueName),
      history: history.slice(-10), // Last 10 snapshots
    };
  }

  /**
   * Get all queue metrics
   * @returns {Object} All queue metrics
   */
  getAllMetrics() {
    return this.aggregateMetrics();
  }

  /**
   * Clean up old metrics beyond retention period
   */
  cleanup() {
    const cutoffTime = Date.now() - this.retentionPeriod;
    let cleaned = 0;

    for (const [queueName, history] of this.history) {
      const originalLength = history.length;
      const filtered = history.filter(
        (snapshot) => snapshot.timestamp >= cutoffTime
      );
      this.history.set(queueName, filtered);
      cleaned += originalLength - filtered.length;
    }

    if (cleaned > 0) {
      logger.debug(`[QueueMetrics] Cleaned up ${cleaned} old metric snapshots`);
    }
  }

  /**
   * Reset metrics for a queue (useful for testing)
   * @param {string} queueName - Name of the queue
   */
  resetQueue(queueName) {
    this.processingTimes.set(queueName, []);
    this.successCounts.set(queueName, 0);
    this.failureCounts.set(queueName, 0);
    this.history.set(queueName, []);
    logger.debug(`[QueueMetrics] Reset metrics for queue: ${queueName}`);
  }
}

// Export singleton instance
const queueMetrics = new QueueMetrics();
module.exports = queueMetrics;
