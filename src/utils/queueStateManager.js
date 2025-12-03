/**
 * QueueStateManager - Manages global queue processing state
 * Ensures only one job runs at a time across all queues to prevent resource conflicts
 * with shared singletons (PuppeteerManager, ProcessingTracker)
 */

const logger = require("./logger");

class QueueStateManager {
  constructor() {
    this.queues = new Map(); // queueName -> queue instance
    this.canProcess = true;
    this.currentJob = null; // Track which job is currently running
    this.isInitialized = false;
    this.pauseStartTime = null; // Track when queues were paused (for timeout detection)
    this.maxPauseDuration = 2 * 60 * 60 * 1000; // 2 hours max pause (safety timeout)
    this.recoveryCheckInterval = null; // Interval for checking stuck pauses
  }

  /**
   * Register a queue for state management
   * @param {Queue} queue - Bull queue instance
   * @param {string} queueName - Human-readable queue name
   */
  registerQueue(queue, queueName) {
    if (!queue) {
      logger.warn(
        `[QueueStateManager] Attempted to register null queue: ${queueName}`
      );
      return;
    }

    this.queues.set(queueName, queue);
    logger.info(`[QueueStateManager] Queue registered: ${queueName}`, {
      totalQueues: this.queues.size,
    });
  }

  /**
   * Pause all registered queues except the one currently processing
   * Called when a job starts to ensure exclusive resource access
   * @param {string} reason - Reason for pausing (e.g., "Job started: queueName")
   * @param {string} currentQueueName - Name of queue that's currently processing (optional)
   */
  async pauseAllQueues(reason, currentQueueName = null) {
    // If canProcess is already false, we still need to pause other queues
    // (canProcess may have been set to false before this call to prevent race conditions)
    const wasAlreadyPaused = !this.canProcess;

    if (wasAlreadyPaused) {
      logger.debug(
        `[QueueStateManager] Queues already paused. Pausing remaining queues. Reason: ${reason}`,
        {
          currentJob: this.currentJob,
          newReason: reason,
        }
      );
    }

    // Set state (idempotent - safe to call multiple times)
    this.canProcess = false;
    this.currentJob = currentQueueName || reason;
    if (!this.pauseStartTime) {
      this.pauseStartTime = Date.now(); // Track when pause started
    }
    const pausedQueues = [];

    // Start recovery check interval if not already running
    this.startRecoveryCheck();

    for (const [name, queue] of this.queues) {
      try {
        // Don't pause the queue that's currently processing (it's already processing)
        // But pause all others to prevent new jobs from starting
        if (name !== currentQueueName) {
          // Check if queue is already paused to avoid unnecessary pause calls
          const isPaused = await queue.isPaused();
          if (!isPaused) {
            await queue.pause();
            pausedQueues.push(name);
          }
        }
      } catch (error) {
        logger.error(`[QueueStateManager] Error pausing queue ${name}`, {
          error: error.message,
          queueName: name,
        });
      }
    }

    if (pausedQueues.length > 0 || !wasAlreadyPaused) {
      logger.info(
        `[QueueStateManager] ⏸️ Paused ${pausedQueues.length} queue(s). Reason: ${reason}`,
        {
          pausedQueues,
          reason,
          currentJob: this.currentJob,
          totalQueues: this.queues.size,
          wasAlreadyPaused,
        }
      );
    }
  }

  /**
   * Resume all registered queues
   * Called when a job completes to allow next job to process
   * @param {string} reason - Reason for resuming (e.g., "Job completed: queueName")
   */
  async resumeAllQueues(reason) {
    if (this.canProcess) {
      // This is expected when resume is called from both finally block and failed handler
      // Log at debug level instead of warn since it's normal behavior
      logger.debug(
        `[QueueStateManager] Queues already resumed (idempotent call). Reason: ${reason}`,
        {
          currentJob: this.currentJob,
          note: "This is normal when resume is called from multiple safety nets",
        }
      );
      return;
    }

    this.canProcess = true;
    const previousJob = this.currentJob;
    this.currentJob = null;
    this.pauseStartTime = null; // Clear pause timestamp
    const resumedQueues = [];

    // Stop recovery check interval since we're resuming
    this.stopRecoveryCheck();

    for (const [name, queue] of this.queues) {
      try {
        await queue.resume();
        resumedQueues.push(name);
      } catch (error) {
        logger.error(`[QueueStateManager] Error resuming queue ${name}`, {
          error: error.message,
          queueName: name,
        });
      }
    }

    logger.info(
      `[QueueStateManager] ▶️ Resumed ${resumedQueues.length} queue(s). Reason: ${reason}`,
      {
        resumedQueues,
        reason,
        previousJob,
        totalQueues: this.queues.size,
      }
    );
  }

  /**
   * Get current state for monitoring
   * @returns {Object} Current state information
   */
  getState() {
    return {
      canProcess: this.canProcess,
      currentJob: this.currentJob,
      registeredQueues: Array.from(this.queues.keys()),
      totalQueues: this.queues.size,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Check if any job is currently processing
   * @returns {boolean} True if a job is processing
   */
  isProcessing() {
    return !this.canProcess && this.currentJob !== null;
  }

  /**
   * Mark state manager as initialized
   */
  markInitialized() {
    this.isInitialized = true;
    logger.info("[QueueStateManager] State manager initialized", {
      state: this.getState(),
    });
  }

  /**
   * Recovery: Resume all queues if they're stuck in paused state
   * Called on worker startup or when detecting stuck pause
   * @param {string} reason - Reason for recovery resume
   */
  async recoverFromStuckPause(reason = "Recovery: Detected stuck pause state") {
    if (this.canProcess) {
      // Already resumed, nothing to recover
      return;
    }

    logger.warn(
      `[QueueStateManager] 🔄 RECOVERY: Resuming queues from stuck pause state`,
      {
        reason,
        currentJob: this.currentJob,
        pauseDuration: this.pauseStartTime
          ? Date.now() - this.pauseStartTime
          : null,
      }
    );

    await this.resumeAllQueues(reason);
  }

  /**
   * Start recovery check interval to detect stuck pauses
   * Checks every 5 minutes if pause has exceeded max duration
   */
  startRecoveryCheck() {
    if (this.recoveryCheckInterval) {
      return; // Already running
    }

    this.recoveryCheckInterval = setInterval(() => {
      if (!this.canProcess && this.pauseStartTime) {
        const pauseDuration = Date.now() - this.pauseStartTime;

        // If paused longer than max duration, force resume
        if (pauseDuration > this.maxPauseDuration) {
          logger.error(
            `[QueueStateManager] ⚠️ CRITICAL: Pause exceeded max duration (${this.maxPauseDuration}ms). Forcing resume.`,
            {
              pauseDuration,
              maxDuration: this.maxPauseDuration,
              currentJob: this.currentJob,
            }
          );

          this.recoverFromStuckPause(
            `Timeout: Pause exceeded ${this.maxPauseDuration}ms (${Math.round(
              this.maxPauseDuration / 60000
            )} minutes)`
          );
        } else {
          // Log warning if approaching timeout (80% of max)
          const warningThreshold = this.maxPauseDuration * 0.8;
          if (pauseDuration > warningThreshold) {
            logger.warn(
              `[QueueStateManager] ⚠️ WARNING: Pause approaching timeout`,
              {
                pauseDuration,
                maxDuration: this.maxPauseDuration,
                currentJob: this.currentJob,
                timeRemaining: this.maxPauseDuration - pauseDuration,
              }
            );
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    logger.debug("[QueueStateManager] Recovery check interval started");
  }

  /**
   * Stop recovery check interval
   */
  stopRecoveryCheck() {
    if (this.recoveryCheckInterval) {
      clearInterval(this.recoveryCheckInterval);
      this.recoveryCheckInterval = null;
      logger.debug("[QueueStateManager] Recovery check interval stopped");
    }
  }

  /**
   * Check queue states and recover if needed
   * Called on worker startup to ensure queues aren't stuck paused
   */
  async checkAndRecoverOnStartup() {
    logger.info("[QueueStateManager] Checking queue states on startup...");

    // Check if any queues are paused
    let pausedCount = 0;
    for (const [name, queue] of this.queues) {
      try {
        const isPaused = await queue.isPaused();
        if (isPaused) {
          pausedCount++;
          logger.warn(`[QueueStateManager] Queue ${name} is paused on startup`);
        }
      } catch (error) {
        logger.error(
          `[QueueStateManager] Error checking pause state for ${name}`,
          { error: error.message }
        );
      }
    }

    // If queues are paused but we think we can process, recover
    if (pausedCount > 0 && this.canProcess) {
      logger.warn(
        `[QueueStateManager] Detected ${pausedCount} paused queue(s) but canProcess=true. Resuming all queues.`
      );
      for (const [name, queue] of this.queues) {
        try {
          await queue.resume();
        } catch (error) {
          logger.error(`[QueueStateManager] Error resuming ${name}`, {
            error: error.message,
          });
        }
      }
    }

    // If we think we're paused but no queues are actually paused, reset state
    if (!this.canProcess && pausedCount === 0) {
      logger.warn(
        `[QueueStateManager] State says paused but no queues are paused. Resetting state.`
      );
      this.canProcess = true;
      this.currentJob = null;
      this.pauseStartTime = null;
      this.stopRecoveryCheck();
    }

    logger.info("[QueueStateManager] Startup recovery check completed", {
      pausedQueues: pausedCount,
      canProcess: this.canProcess,
      currentJob: this.currentJob,
    });
  }
}

// Export singleton instance
const queueStateManager = new QueueStateManager();
module.exports = queueStateManager;
