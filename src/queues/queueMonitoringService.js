/**
 * QueueMonitoringService - Orchestrates queue metrics collection and health checks
 * Provides periodic monitoring, metrics logging, and external access to metrics
 */

const logger = require("../utils/logger");
const queueMetrics = require("./queueMetrics");
const queueHealthCheck = require("./queueHealthCheck");
const queueStateManager = require("../utils/queueStateManager");
const { WebClient } = require("@slack/web-api");

class QueueMonitoringService {
  constructor(options = {}) {
    this.collectionInterval = options.collectionInterval || 5 * 60 * 1000; // 5 minutes default
    this.healthCheckInterval = options.healthCheckInterval || 10 * 60 * 1000; // 10 minutes default
    this.summaryLogInterval = options.summaryLogInterval || 30 * 60 * 1000; // 30 minutes default
    this.alertCheckInterval = options.alertCheckInterval || 5 * 60 * 1000; // 5 minutes default
    this.queues = null; // Will be set during initialization
    this.isRunning = false;
    this.intervals = {
      metrics: null,
      health: null,
      summary: null,
      alerts: null,
    };
    this.lastCollection = null;
    this.lastHealthCheck = null;

    // Backlog thresholds per queue type (configurable)
    this.backlogThresholds = options.backlogThresholds || {
      // Critical queues (onboarding)
      onboardNewAccount: 5,
      // Regular queues
      default: 10,
      // Direct processing queues (can have larger backlogs)
      syncClubDirect: 15,
      syncAssociationDirect: 15,
    };

    // Processing rate thresholds (percentage of average)
    this.processingRateThreshold = options.processingRateThreshold || 0.5; // 50% of average
    this.processingRateWindow = options.processingRateWindow || 15 * 60 * 1000; // 15 minutes

    // Failure rate threshold (percentage)
    this.failureRateThreshold = options.failureRateThreshold || 20; // 20%

    // Alert throttling (prevent spam)
    this.alertThrottle = options.alertThrottle || 30 * 60 * 1000; // 30 minutes
    this.lastAlerts = new Map(); // queueName -> { type, timestamp }

    // Slack configuration
    this.slackToken = process.env.SlackToken;
    this.slackChannel =
      process.env.SLACK_QUEUE_MONITORING_CHANNEL || "#queue-monitoring";
    this.slackClient = this.slackToken ? new WebClient(this.slackToken) : null;
  }

  /**
   * Initialize monitoring service with queues
   * @param {Map|Object} queues - Map or object of queueName -> queue instance
   */
  initialize(queues) {
    if (this.isRunning) {
      logger.warn("[QueueMonitoringService] Already initialized and running");
      return;
    }

    // Convert object to Map if needed
    if (!(queues instanceof Map)) {
      const queuesMap = new Map();
      for (const [key, value] of Object.entries(queues)) {
        queuesMap.set(key, value);
      }
      this.queues = queuesMap;
    } else {
      this.queues = queues;
    }

    logger.info("[QueueMonitoringService] Initialized", {
      totalQueues: this.queues.size,
      collectionInterval: this.collectionInterval / 1000 / 60,
      healthCheckInterval: this.healthCheckInterval / 1000 / 60,
    });
  }

  /**
   * Collect metrics for all queues
   * @returns {Promise<Object>} Aggregated metrics
   */
  async collectMetrics() {
    if (!this.queues || this.queues.size === 0) {
      logger.warn(
        "[QueueMonitoringService] No queues initialized for metrics collection"
      );
      return null;
    }

    try {
      const metricsPromises = [];
      for (const [queueName, queue] of this.queues) {
        metricsPromises.push(queueMetrics.collectQueueStats(queue, queueName));
      }

      const results = await Promise.allSettled(metricsPromises);
      const aggregated = queueMetrics.aggregateMetrics();

      this.lastCollection = Date.now();

      logger.debug("[QueueMonitoringService] Metrics collected", {
        timestamp: aggregated.timestamp,
        totalQueues: aggregated.totalQueues,
        totalWaiting: aggregated.system.totalWaiting,
        totalActive: aggregated.system.totalActive,
      });

      return aggregated;
    } catch (error) {
      logger.error("[QueueMonitoringService] Error collecting metrics", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Perform health check for all queues
   * @returns {Promise<Object>} Health check results
   */
  async performHealthCheck() {
    if (!this.queues || this.queues.size === 0) {
      logger.warn(
        "[QueueMonitoringService] No queues initialized for health check"
      );
      return null;
    }

    try {
      const healthCheck = await queueHealthCheck.checkAllQueuesHealth(
        this.queues
      );
      this.lastHealthCheck = Date.now();

      logger.debug("[QueueMonitoringService] Health check completed", {
        status: healthCheck.status,
        healthy: healthCheck.healthy,
        healthyQueues: healthCheck.system.healthyQueues,
        degradedQueues: healthCheck.system.degradedQueues,
        unhealthyQueues: healthCheck.system.unhealthyQueues,
      });

      return healthCheck;
    } catch (error) {
      logger.error("[QueueMonitoringService] Error performing health check", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Log metrics summary
   */
  async logMetricsSummary() {
    try {
      const aggregated = queueMetrics.aggregateMetrics();
      const healthSummary = await queueHealthCheck.getHealthSummary(
        this.queues
      );

      logger.info("[QueueMonitoringService] 📊 Queue Metrics Summary", {
        timestamp: new Date().toISOString(),
        health: {
          status: healthSummary.status,
          healthy: healthSummary.summary.healthy,
          degraded: healthSummary.summary.degraded,
          unhealthy: healthSummary.summary.unhealthy,
        },
        system: {
          totalQueues: aggregated.system.totalQueues,
          totalWaiting: aggregated.system.totalWaiting,
          totalActive: aggregated.system.totalActive,
          totalProcessed: aggregated.system.totalProcessed,
          averageSuccessRate: `${aggregated.system.averageSuccessRate}%`,
          averageProcessingTime: `${aggregated.system.averageProcessingTime}ms`,
        },
        queues: Object.keys(aggregated.queues).map((queueName) => {
          const queue = aggregated.queues[queueName];
          return {
            name: queueName,
            waiting: queue.counts.waiting,
            active: queue.counts.active,
            processingRate: `${queue.processingRate || 0} jobs/min`,
            successRate: `${queue.processing.successRate}%`,
            avgProcessingTime: `${queue.processing.average}ms`,
          };
        }),
      });

      // Log health issues if any
      if (healthSummary.issues && healthSummary.issues.length > 0) {
        logger.warn("[QueueMonitoringService] ⚠️ Health Issues Detected", {
          issues: healthSummary.issues,
        });
      }
    } catch (error) {
      logger.error("[QueueMonitoringService] Error logging metrics summary", {
        error: error.message,
      });
    }
  }

  /**
   * Start periodic monitoring
   */
  start() {
    if (this.isRunning) {
      logger.warn("[QueueMonitoringService] Already running");
      return;
    }

    if (!this.queues || this.queues.size === 0) {
      logger.error(
        "[QueueMonitoringService] Cannot start: queues not initialized"
      );
      throw new Error("Queues not initialized. Call initialize() first.");
    }

    this.isRunning = true;

    // Start periodic metrics collection
    this.intervals.metrics = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error(
          "[QueueMonitoringService] Error in periodic metrics collection",
          {
            error: error.message,
          }
        );
      }
    }, this.collectionInterval);

    // Start periodic health checks
    this.intervals.health = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error(
          "[QueueMonitoringService] Error in periodic health check",
          {
            error: error.message,
          }
        );
      }
    }, this.healthCheckInterval);

    // Start periodic summary logging
    this.intervals.summary = setInterval(async () => {
      try {
        await this.logMetricsSummary();
      } catch (error) {
        logger.error(
          "[QueueMonitoringService] Error in periodic summary logging",
          {
            error: error.message,
          }
        );
      }
    }, this.summaryLogInterval);

    // Start periodic alert checking
    this.intervals.alerts = setInterval(async () => {
      try {
        await this.checkAndAlert();
      } catch (error) {
        logger.error("[QueueMonitoringService] Error in periodic alert check", {
          error: error.message,
        });
      }
    }, this.alertCheckInterval);

    // Perform initial collection and health check
    this.collectMetrics().catch((error) => {
      logger.error(
        "[QueueMonitoringService] Error in initial metrics collection",
        {
          error: error.message,
        }
      );
    });

    this.performHealthCheck().catch((error) => {
      logger.error("[QueueMonitoringService] Error in initial health check", {
        error: error.message,
      });
    });

    logger.info("[QueueMonitoringService] ✅ Monitoring started", {
      collectionInterval: `${this.collectionInterval / 1000 / 60} minutes`,
      healthCheckInterval: `${this.healthCheckInterval / 1000 / 60} minutes`,
      summaryLogInterval: `${this.summaryLogInterval / 1000 / 60} minutes`,
    });
  }

  /**
   * Stop periodic monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear all intervals
    if (this.intervals.metrics) {
      clearInterval(this.intervals.metrics);
      this.intervals.metrics = null;
    }

    if (this.intervals.health) {
      clearInterval(this.intervals.health);
      this.intervals.health = null;
    }

    if (this.intervals.summary) {
      clearInterval(this.intervals.summary);
      this.intervals.summary = null;
    }

    if (this.intervals.alerts) {
      clearInterval(this.intervals.alerts);
      this.intervals.alerts = null;
    }

    logger.info("[QueueMonitoringService] ⏹️ Monitoring stopped");
  }

  /**
   * Get current metrics (for external access)
   * @returns {Object} Current aggregated metrics
   */
  getMetrics() {
    return queueMetrics.getAllMetrics();
  }

  /**
   * Get metrics for specific queue
   * @param {string} queueName - Name of the queue
   * @returns {Object|null} Queue metrics or null if not found
   */
  getQueueMetrics(queueName) {
    return queueMetrics.getQueueMetrics(queueName);
  }

  /**
   * Get health status (for external access)
   * @returns {Promise<Object>} Health check summary
   */
  async getHealthStatus() {
    if (!this.queues) {
      return {
        status: "unknown",
        error: "Queues not initialized",
      };
    }
    return await queueHealthCheck.getHealthSummary(this.queues);
  }

  /**
   * Get full health check results
   * @returns {Promise<Object>} Full health check results
   */
  async getFullHealthCheck() {
    if (!this.queues) {
      return null;
    }
    return await queueHealthCheck.checkAllQueuesHealth(this.queues);
  }

  /**
   * Get monitoring service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      totalQueues: this.queues ? this.queues.size : 0,
      lastCollection: this.lastCollection,
      lastHealthCheck: this.lastHealthCheck,
      intervals: {
        metrics: this.intervals.metrics !== null,
        health: this.intervals.health !== null,
        summary: this.intervals.summary !== null,
        alerts: this.intervals.alerts !== null,
      },
      configuration: {
        collectionInterval: this.collectionInterval,
        healthCheckInterval: this.healthCheckInterval,
        summaryLogInterval: this.summaryLogInterval,
        alertCheckInterval: this.alertCheckInterval,
        backlogThresholds: this.backlogThresholds,
        processingRateThreshold: this.processingRateThreshold,
        failureRateThreshold: this.failureRateThreshold,
        alertThrottle: this.alertThrottle,
      },
    };
  }

  /**
   * Cleanup old metrics
   */
  cleanup() {
    queueMetrics.cleanup();
    logger.debug("[QueueMonitoringService] Cleaned up old metrics");
  }

  /**
   * Get backlog threshold for a queue
   * @param {string} queueName - Name of the queue
   * @returns {number} Backlog threshold
   */
  getBacklogThreshold(queueName) {
    return this.backlogThresholds[queueName] || this.backlogThresholds.default;
  }

  /**
   * Check if alert should be throttled
   * @param {string} queueName - Name of the queue
   * @param {string} alertType - Type of alert
   * @returns {boolean} True if alert should be throttled
   */
  shouldThrottleAlert(queueName, alertType) {
    const key = `${queueName}:${alertType}`;
    const lastAlert = this.lastAlerts.get(key);
    if (!lastAlert) {
      return false;
    }
    const timeSinceLastAlert = Date.now() - lastAlert.timestamp;
    return timeSinceLastAlert < this.alertThrottle;
  }

  /**
   * Record alert timestamp
   * @param {string} queueName - Name of the queue
   * @param {string} alertType - Type of alert
   */
  recordAlert(queueName, alertType) {
    const key = `${queueName}:${alertType}`;
    this.lastAlerts.set(key, {
      type: alertType,
      timestamp: Date.now(),
    });
  }

  /**
   * Send Slack alert
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {string} severity - Alert severity (warning, error, critical)
   */
  async sendSlackAlert(title, message, severity = "warning") {
    // Fail silently if Slack not configured - don't break monitoring
    if (!this.slackClient) {
      logger.debug(
        "[QueueMonitoringService] Slack not configured, skipping alert"
      );
      return;
    }

    const emoji =
      severity === "critical" ? "🚨" : severity === "error" ? "❌" : "⚠️";

    try {
      await this.slackClient.chat.postMessage({
        channel: this.slackChannel,
        text: `${emoji} ${title}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${emoji} ${title}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Timestamp: ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      });

      logger.info("[QueueMonitoringService] Slack alert sent", {
        title,
        severity,
        channel: this.slackChannel,
      });
    } catch (error) {
      // Log error but don't throw - Slack failures should not break monitoring
      logger.error("[QueueMonitoringService] Failed to send Slack alert", {
        error: error.message,
        errorCode: error.code,
        title,
        severity,
        channel: this.slackChannel,
      });
      // Don't rethrow - monitoring should continue even if Slack fails
    }
  }

  /**
   * Detect backlog issues
   * @param {Object} metrics - Aggregated metrics
   * @returns {Array} Array of backlog alerts
   */
  detectBacklogs(metrics) {
    const alerts = [];

    for (const [queueName, queueMetrics] of Object.entries(
      metrics.queues || {}
    )) {
      const waiting = queueMetrics.counts?.waiting || 0;
      const threshold = this.getBacklogThreshold(queueName);

      if (waiting > threshold) {
        const alertType = "backlog";
        if (!this.shouldThrottleAlert(queueName, alertType)) {
          alerts.push({
            queueName,
            type: alertType,
            severity: waiting > threshold * 2 ? "error" : "warning",
            message: `Queue ${queueName} has ${waiting} waiting jobs (threshold: ${threshold})`,
            details: {
              waiting,
              threshold,
              active: queueMetrics.counts?.active || 0,
            },
          });
          this.recordAlert(queueName, alertType);
        }
      }
    }

    return alerts;
  }

  /**
   * Detect processing rate issues
   * @param {Object} metrics - Aggregated metrics
   * @returns {Array} Array of processing rate alerts
   */
  detectProcessingRateIssues(metrics) {
    const alerts = [];

    for (const [queueName, queueMetricsData] of Object.entries(
      metrics.queues || {}
    )) {
      // Get current processing rate from aggregated metrics
      const currentRate = queueMetricsData.processingRate || 0;

      // Get historical metrics from queueMetrics module
      const queueHistoricalMetrics = queueMetrics.getQueueMetrics(queueName);
      if (!queueHistoricalMetrics || !queueHistoricalMetrics.history) {
        continue; // Need history to calculate average
      }

      const history = queueHistoricalMetrics.history;
      if (history.length < 2) {
        continue; // Need at least 2 snapshots
      }

      // Calculate average processing rate from historical totalProcessed counts
      const processedCounts = history
        .map((snapshot) => snapshot.processing?.totalProcessed || 0)
        .filter((count) => count > 0);

      if (processedCounts.length < 2) {
        continue;
      }

      // Calculate rate from first and last snapshot
      const first = processedCounts[0];
      const last = processedCounts[processedCounts.length - 1];
      const firstTimestamp = history[0].timestamp;
      const lastTimestamp = history[history.length - 1].timestamp;
      const timeDiff = (lastTimestamp - firstTimestamp) / 1000 / 60; // minutes
      const jobsProcessed = last - first;
      const averageRate = timeDiff > 0 ? jobsProcessed / timeDiff : 0;

      if (averageRate === 0) {
        continue;
      }

      const threshold = averageRate * this.processingRateThreshold;

      if (currentRate < threshold && averageRate > 0) {
        const alertType = "processing_rate";
        if (!this.shouldThrottleAlert(queueName, alertType)) {
          alerts.push({
            queueName,
            type: alertType,
            severity: "warning",
            message: `Queue ${queueName} processing rate dropped to ${currentRate.toFixed(
              2
            )} jobs/min (average: ${averageRate.toFixed(
              2
            )}, threshold: ${threshold.toFixed(2)})`,
            details: {
              currentRate: currentRate.toFixed(2),
              averageRate: averageRate.toFixed(2),
              threshold: threshold.toFixed(2),
            },
          });
          this.recordAlert(queueName, alertType);
        }
      }
    }

    return alerts;
  }

  /**
   * Detect failure rate issues
   * @param {Object} metrics - Aggregated metrics
   * @returns {Array} Array of failure rate alerts
   */
  detectFailureRateIssues(metrics) {
    const alerts = [];

    for (const [queueName, queueMetrics] of Object.entries(
      metrics.queues || {}
    )) {
      const failureRate = queueMetrics.processing?.failureRate || 0;
      const totalProcessed = queueMetrics.processing?.totalProcessed || 0;

      // Only alert if we have enough data (at least 10 jobs processed)
      if (totalProcessed >= 10 && failureRate > this.failureRateThreshold) {
        const alertType = "failure_rate";
        if (!this.shouldThrottleAlert(queueName, alertType)) {
          alerts.push({
            queueName,
            type: alertType,
            severity: failureRate > 50 ? "error" : "warning",
            message: `Queue ${queueName} has high failure rate: ${failureRate.toFixed(
              2
            )}% (threshold: ${this.failureRateThreshold}%)`,
            details: {
              failureRate,
              threshold: this.failureRateThreshold,
              totalProcessed,
              successCount: queueMetrics.processing?.successCount || 0,
              failureCount: queueMetrics.processing?.failureCount || 0,
            },
          });
          this.recordAlert(queueName, alertType);
        }
      }
    }

    return alerts;
  }

  /**
   * Detect health degradation
   * @param {Object} healthCheck - Health check results
   * @returns {Array} Array of health alerts
   */
  detectHealthIssues(healthCheck) {
    const alerts = [];

    if (!healthCheck || !healthCheck.healthy) {
      const alertType = "health_degradation";
      const severity =
        healthCheck.status === "unhealthy" ? "critical" : "error";

      // Check for specific issues
      for (const [queueName, queueHealth] of Object.entries(
        healthCheck.queues || {}
      )) {
        if (!queueHealth.healthy) {
          if (!this.shouldThrottleAlert(queueName, alertType)) {
            alerts.push({
              queueName,
              type: alertType,
              severity:
                queueHealth.status === "unhealthy" ? "critical" : "error",
              message: `Queue ${queueName} health status: ${queueHealth.status}`,
              details: {
                status: queueHealth.status,
                issues: queueHealth.issues || [],
                checks: queueHealth.checks || {},
              },
            });
            this.recordAlert(queueName, alertType);
          }
        }
      }

      // System-wide health issues
      if (healthCheck.system?.unhealthyQueues > 0) {
        alerts.push({
          queueName: "system",
          type: alertType,
          severity: "critical",
          message: `System health degraded: ${healthCheck.system.unhealthyQueues} unhealthy queue(s)`,
          details: {
            status: healthCheck.status,
            unhealthyQueues: healthCheck.system.unhealthyQueues,
            degradedQueues: healthCheck.system.degradedQueues,
            issues: healthCheck.issues || [],
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Process and send alerts
   * @param {Array} alerts - Array of alerts to process
   */
  async processAlerts(alerts) {
    for (const alert of alerts) {
      try {
        const title = `Queue Alert: ${alert.queueName}`;
        let message = alert.message + "\n\n";

        // Add details
        if (alert.details) {
          message += "Details:\n";
          for (const [key, value] of Object.entries(alert.details)) {
            if (Array.isArray(value)) {
              message += `• ${key}: ${value.join(", ")}\n`;
            } else {
              message += `• ${key}: ${value}\n`;
            }
          }
        }

        // Send Slack alert (errors are handled internally, won't throw)
        await this.sendSlackAlert(title, message, alert.severity);

        logger.warn("[QueueMonitoringService] Alert triggered", {
          queueName: alert.queueName,
          type: alert.type,
          severity: alert.severity,
        });
      } catch (error) {
        // Catch any unexpected errors in alert processing - don't break monitoring
        logger.error("[QueueMonitoringService] Error processing alert", {
          error: error.message,
          errorStack: error.stack,
          alert: alert.queueName,
          alertType: alert.type,
        });
        // Don't rethrow - continue processing other alerts
      }
    }
  }

  /**
   * Check for alerts and send notifications
   * Errors are caught and logged but never thrown to prevent breaking monitoring
   */
  async checkAndAlert() {
    if (!this.queues || this.queues.size === 0) {
      return;
    }

    try {
      const metrics = queueMetrics.aggregateMetrics();
      const healthCheck = await queueHealthCheck.checkAllQueuesHealth(
        this.queues
      );

      const alerts = [];

      // Detect different types of issues (each wrapped in try-catch internally)
      try {
        alerts.push(...this.detectBacklogs(metrics));
      } catch (error) {
        logger.error("[QueueMonitoringService] Error detecting backlogs", {
          error: error.message,
        });
      }

      try {
        alerts.push(...this.detectProcessingRateIssues(metrics));
      } catch (error) {
        logger.error(
          "[QueueMonitoringService] Error detecting processing rate issues",
          {
            error: error.message,
          }
        );
      }

      try {
        alerts.push(...this.detectFailureRateIssues(metrics));
      } catch (error) {
        logger.error(
          "[QueueMonitoringService] Error detecting failure rate issues",
          {
            error: error.message,
          }
        );
      }

      try {
        alerts.push(...this.detectHealthIssues(healthCheck));
      } catch (error) {
        logger.error(
          "[QueueMonitoringService] Error detecting health issues",
          {
            error: error.message,
          }
        );
      }

      // Process and send alerts (errors handled internally)
      if (alerts.length > 0) {
        await this.processAlerts(alerts);
      }
    } catch (error) {
      // Catch-all for any unexpected errors - never throw to prevent breaking monitoring
      logger.error("[QueueMonitoringService] Error checking alerts", {
        error: error.message,
        errorStack: error.stack,
      });
      // Don't rethrow - monitoring should continue even if alert checking fails
    }
  }
}

// Export singleton instance
const queueMonitoringService = new QueueMonitoringService();
module.exports = queueMonitoringService;
