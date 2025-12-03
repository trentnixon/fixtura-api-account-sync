/**
 * QueueHealthCheck - Health check functions for Bull queues
 * Evaluates queue state, connectivity, and detects issues
 */

const logger = require("../utils/logger");
const queueStateManager = require("../utils/queueStateManager");
const getRedisClient = require("../config/redisConfig");

class QueueHealthCheck {
  constructor(options = {}) {
    this.stuckJobThreshold = options.stuckJobThreshold || 30 * 60 * 1000; // 30 minutes default
    this.redisTimeout = options.redisTimeout || 5000; // 5 seconds default
  }

  /**
   * Check Redis connectivity
   * @param {string} type - Redis client type (default: 'default')
   * @returns {Promise<{healthy: boolean, error?: string}>}
   */
  async checkRedisConnectivity(type = "default") {
    try {
      const client = getRedisClient(type);
      if (!client) {
        return {
          healthy: false,
          error: "Redis client not initialized",
        };
      }

      // Try a simple PING command with timeout
      const pingPromise = client.ping();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), this.redisTimeout)
      );

      await Promise.race([pingPromise, timeoutPromise]);

      return {
        healthy: true,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if queue is paused unexpectedly
   * @param {Queue} queue - Bull queue instance
   * @param {string} queueName - Name of the queue
   * @param {boolean} expectedPaused - Whether queue should be paused (based on state manager)
   * @returns {Promise<{healthy: boolean, isPaused: boolean, issue?: string}>}
   */
  async checkQueuePauseState(queue, queueName, expectedPaused) {
    try {
      const isPaused = await queue.isPaused();

      // If queue is paused but shouldn't be (and no job is processing)
      if (isPaused && !expectedPaused && queueStateManager.canProcess) {
        return {
          healthy: false,
          isPaused: true,
          issue: `Queue ${queueName} is paused but should be active (no job processing)`,
        };
      }

      // If queue is not paused but should be (job is processing)
      if (!isPaused && expectedPaused && !queueStateManager.canProcess) {
        return {
          healthy: false,
          isPaused: false,
          issue: `Queue ${queueName} is active but should be paused (job processing)`,
        };
      }

      return {
        healthy: true,
        isPaused,
      };
    } catch (error) {
      return {
        healthy: false,
        isPaused: false,
        issue: `Error checking pause state: ${error.message}`,
      };
    }
  }

  /**
   * Check for stuck jobs (jobs in active state for extended period)
   * @param {Queue} queue - Bull queue instance
   * @param {string} queueName - Name of the queue
   * @returns {Promise<{healthy: boolean, stuckJobs: Array, count: number}>}
   */
  async checkStuckJobs(queue, queueName) {
    try {
      const activeJobs = await queue.getJobs(["active"]);
      const stuckJobs = [];
      const now = Date.now();

      for (const job of activeJobs) {
        // Check if job has been active for longer than threshold
        // Bull stores processedOn timestamp when job starts processing
        if (job.processedOn) {
          const activeDuration = now - job.processedOn;
          if (activeDuration > this.stuckJobThreshold) {
            stuckJobs.push({
              jobId: job.id,
              activeDuration,
              activeDurationMinutes: Math.round(activeDuration / 60000),
              data: job.data,
            });
          }
        }
      }

      return {
        healthy: stuckJobs.length === 0,
        stuckJobs,
        count: stuckJobs.length,
      };
    } catch (error) {
      logger.error(`[QueueHealthCheck] Error checking stuck jobs for ${queueName}`, {
        error: error.message,
      });
      return {
        healthy: false,
        stuckJobs: [],
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Validate queue state manager consistency
   * @param {Map} queues - Map of queueName -> queue instance
   * @returns {Promise<{healthy: boolean, issues: Array}>}
   */
  async validateQueueStateManager(queues) {
    const issues = [];
    const stateManagerState = queueStateManager.getState();

    // Check if state manager is initialized
    if (!stateManagerState.isInitialized) {
      issues.push("Queue state manager is not initialized");
    }

    // Check if registered queues match actual queues
    const registeredQueues = stateManagerState.registeredQueues;
    const actualQueues = Array.from(queues.keys());

    const missingInStateManager = actualQueues.filter(
      (q) => !registeredQueues.includes(q)
    );
    if (missingInStateManager.length > 0) {
      issues.push(
        `Queues not registered in state manager: ${missingInStateManager.join(", ")}`
      );
    }

    const extraInStateManager = registeredQueues.filter(
      (q) => !actualQueues.includes(q)
    );
    if (extraInStateManager.length > 0) {
      issues.push(
        `Queues in state manager but not in actual queues: ${extraInStateManager.join(", ")}`
      );
    }

    // Check pause state consistency
    if (!stateManagerState.canProcess && stateManagerState.currentJob === null) {
      issues.push(
        "State manager says queues are paused but no current job is tracked"
      );
    }

    return {
      healthy: issues.length === 0,
      issues,
      stateManagerState,
    };
  }

  /**
   * Perform comprehensive health check for a single queue
   * @param {Queue} queue - Bull queue instance
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Object>} Health check results
   */
  async checkQueueHealth(queue, queueName) {
    const results = {
      queueName,
      timestamp: Date.now(),
      healthy: true,
      status: "healthy",
      checks: {},
      issues: [],
    };

    try {
      // Check Redis connectivity
      const redisCheck = await this.checkRedisConnectivity();
      results.checks.redis = redisCheck;
      if (!redisCheck.healthy) {
        results.healthy = false;
        results.issues.push(`Redis connectivity issue: ${redisCheck.error}`);
      }

      // Check pause state
      const stateManagerState = queueStateManager.getState();
      const expectedPaused = !stateManagerState.canProcess;
      const pauseCheck = await this.checkQueuePauseState(
        queue,
        queueName,
        expectedPaused
      );
      results.checks.pauseState = pauseCheck;
      if (!pauseCheck.healthy) {
        results.healthy = false;
        results.issues.push(pauseCheck.issue);
      }

      // Check for stuck jobs
      const stuckJobsCheck = await this.checkStuckJobs(queue, queueName);
      results.checks.stuckJobs = stuckJobsCheck;
      if (!stuckJobsCheck.healthy) {
        results.healthy = false;
        results.status = "degraded";
        results.issues.push(
          `Found ${stuckJobsCheck.count} stuck job(s) in ${queueName}`
        );
      }

      // Determine overall status
      if (!results.healthy) {
        // If Redis is down or pause state is wrong, it's unhealthy
        if (!redisCheck.healthy || !pauseCheck.healthy) {
          results.status = "unhealthy";
        } else {
          // Stuck jobs alone make it degraded
          results.status = "degraded";
        }
      }

      return results;
    } catch (error) {
      logger.error(`[QueueHealthCheck] Error checking health for ${queueName}`, {
        error: error.message,
        stack: error.stack,
      });
      return {
        queueName,
        timestamp: Date.now(),
        healthy: false,
        status: "unhealthy",
        error: error.message,
        checks: results.checks,
        issues: [...results.issues, `Health check error: ${error.message}`],
      };
    }
  }

  /**
   * Perform health check for all queues
   * @param {Map} queues - Map of queueName -> queue instance
   * @returns {Promise<Object>} System-wide health check results
   */
  async checkAllQueuesHealth(queues) {
    const results = {
      timestamp: Date.now(),
      healthy: true,
      status: "healthy",
      queues: {},
      system: {
        totalQueues: queues.size,
        healthyQueues: 0,
        degradedQueues: 0,
        unhealthyQueues: 0,
      },
      issues: [],
    };

    // Check state manager consistency
    const stateManagerCheck = await this.validateQueueStateManager(queues);
    results.system.stateManager = stateManagerCheck;
    if (!stateManagerCheck.healthy) {
      results.healthy = false;
      results.issues.push(...stateManagerCheck.issues);
    }

    // Check each queue
    for (const [queueName, queue] of queues) {
      const queueHealth = await this.checkQueueHealth(queue, queueName);
      results.queues[queueName] = queueHealth;

      // Update system counts
      if (queueHealth.status === "healthy") {
        results.system.healthyQueues++;
      } else if (queueHealth.status === "degraded") {
        results.system.degradedQueues++;
        results.healthy = false;
      } else if (queueHealth.status === "unhealthy") {
        results.system.unhealthyQueues++;
        results.healthy = false;
      }

      // Collect issues
      if (queueHealth.issues && queueHealth.issues.length > 0) {
        results.issues.push(...queueHealth.issues);
      }
    }

    // Determine overall system status
    if (results.system.unhealthyQueues > 0) {
      results.status = "unhealthy";
    } else if (results.system.degradedQueues > 0) {
      results.status = "degraded";
    }

    return results;
  }

  /**
   * Get health status summary (quick check)
   * @param {Map} queues - Map of queueName -> queue instance
   * @returns {Promise<Object>} Quick health summary
   */
  async getHealthSummary(queues) {
    const healthCheck = await this.checkAllQueuesHealth(queues);
    return {
      status: healthCheck.status,
      healthy: healthCheck.healthy,
      summary: {
        totalQueues: healthCheck.system.totalQueues,
        healthy: healthCheck.system.healthyQueues,
        degraded: healthCheck.system.degradedQueues,
        unhealthy: healthCheck.system.unhealthyQueues,
      },
      issues: healthCheck.issues.slice(0, 5), // Top 5 issues
      timestamp: healthCheck.timestamp,
    };
  }
}

// Export singleton instance
const queueHealthCheck = new QueueHealthCheck();
module.exports = queueHealthCheck;

