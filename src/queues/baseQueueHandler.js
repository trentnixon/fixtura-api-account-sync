/**
 * Base Queue Handler - Common queue processing patterns
 *
 * Provides a unified way to setup queue handlers with common patterns:
 * - Pause/resume all queues for exclusive resource access
 * - Browser cleanup after job completion
 * - CMS notifications (account sync, direct org, email)
 * - Event listeners (failed, completed, stalled)
 * - Test data handling support
 * - Queue error handler integration
 *
 * @module baseQueueHandler
 */

const logger = require("../utils/logger");
const queueStateManager = require("../utils/queueStateManager");
const queueErrorHandler = require("./queueErrorHandler");
const {
  notifyCMSAccountSync,
  notifyDirectOrgProcessing,
  notifyJobStart,
} = require("../utils/cmsNotifier");
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");
const fetcher = require("../utils/fetcher");

/**
 * Setup queue handler with common patterns
 *
 * @param {Object} queue - Bull queue instance
 * @param {string} queueName - Name of the queue for logging
 * @param {Object} options - Configuration options
 * @param {Function} options.processor - Required: async function(job) => void - Queue-specific processing logic
 * @param {number} [options.concurrency=1] - Concurrency level (default: 1)
 * @param {boolean} [options.browserCleanup=false] - Enable browser cleanup after job completion
 * @param {Object} [options.notifications] - Notification configuration
 * @param {string} [options.notifications.type='none'] - Notification type: 'none' | 'cms_account' | 'direct_org' | 'email'
 * @param {boolean} [options.notifications.onSuccess=true] - Send notification on success
 * @param {boolean} [options.notifications.onFailure=true] - Send notification on failure
 * @param {string} [options.notifications.orgType=null] - Org type for direct_org: 'CLUB' | 'ASSOCIATION' (required if type === 'direct_org')
 * @param {Object} [options.eventListeners] - Event listener configuration
 * @param {boolean} [options.eventListeners.failed=true] - Setup failed event listener
 * @param {boolean} [options.eventListeners.completed=false] - Setup completed event listener
 * @param {boolean} [options.eventListeners.stalled=false] - Setup stalled event listener
 * @param {boolean} [options.testDataSupport=false] - Support test data parameter
 * @param {string} [options.queueErrorHandler=null] - Queue name for error handler (e.g., "syncUserAccount")
 * @param {Function} [options.onJobStart=null] - Optional hook: async (job) => void
 * @param {Function} [options.onJobComplete=null] - Optional hook: async (job, result) => void
 * @param {Function} [options.onJobError=null] - Optional hook: async (job, error) => void
 * @param {Function} [options.onFailed=null] - Optional hook: async (job, error) => boolean - Return true to skip default failed handling
 * @param {boolean} [options.slackJobStartNotification=false] - Send Slack notification when job starts
 * @returns {Function} Handler function that supports testData parameter (if testDataSupport is enabled)
 *
 * @example
 * // Basic usage
 * const handler = setupQueueHandler(queue, "myQueue", {
 *   processor: async (job) => {
 *     // Process job
 *   }
 * });
 * await handler();
 *
 * @example
 * // With browser cleanup and CMS notifications
 * const handler = setupQueueHandler(queue, "syncUserAccount", {
 *   processor: async (job) => {
 *     // Process job
 *   },
 *   browserCleanup: true,
 *   notifications: {
 *     type: 'cms_account',
 *     onSuccess: true,
 *     onFailure: true
 *   },
 *   queueErrorHandler: "syncUserAccount"
 * });
 * await handler();
 *
 * @example
 * // With test data support
 * const handler = setupQueueHandler(queue, "updateAccountOnly", {
 *   processor: async (job) => {
 *     // Process job
 *   },
 *   testDataSupport: true,
 *   browserCleanup: true,
 *   notifications: { type: 'cms_account' }
 * });
 * await handler(testData); // Test mode
 * await handler(); // Normal mode
 */
function setupQueueHandler(queue, queueName, options = {}) {
  const {
    processor, // Required
    concurrency = 1,
    browserCleanup = false,
    notifications = {
      type: 'none',
      onSuccess: true,
      onFailure: true,
      orgType: null,
    },
    eventListeners = {
      failed: true,
      completed: false,
      stalled: false,
    },
    testDataSupport = false,
    queueErrorHandler: queueErrorHandlerName = null,
    onJobStart = null,
    onJobComplete = null,
    onJobError = null,
    onFailed = null, // Custom failed handler hook
    slackJobStartNotification = false, // Send Slack notification when job starts
  } = options;

  // Validate required options
  if (!processor || typeof processor !== 'function') {
    throw new Error('processor function is required');
  }

  if (!queue) {
    throw new Error('queue instance is required');
  }

  if (!queueName) {
    throw new Error('queueName is required');
  }

  // Validate notification configuration
  if (notifications.type === 'direct_org' && !notifications.orgType) {
    throw new Error('orgType is required when notifications.type === "direct_org"');
  }

  /**
   * Get account/org ID from job data
   * @param {Object} jobData - Job data
   * @returns {string|null} Account/org ID or null
   */
  function getAccountId(jobData) {
    return jobData?.getSync?.ID || null;
  }

  /**
   * Send notification based on configuration
   * @param {string} accountId - Account/org ID
   * @param {string} status - Status: 'completed' | 'failed'
   * @param {string} [errorMessage] - Error message for failures
   */
  async function sendNotification(accountId, status, errorMessage = null) {
    if (!accountId || notifications.type === 'none') {
      return;
    }

    try {
      if (notifications.type === 'cms_account') {
        if ((status === 'completed' && notifications.onSuccess) ||
            (status === 'failed' && notifications.onFailure)) {
          await notifyCMSAccountSync(accountId, status);
        }
      } else if (notifications.type === 'direct_org') {
        if ((status === 'completed' && notifications.onSuccess) ||
            (status === 'failed' && notifications.onFailure)) {
          await notifyDirectOrgProcessing(
            accountId,
            notifications.orgType,
            status,
            errorMessage
          );
        }
      } else if (notifications.type === 'email') {
        if (status === 'completed' && notifications.onSuccess) {
          await fetcher(`account/setCompleteEmail/${accountId}`, 'GET');
        }
        // Email notifications typically only sent on success
      }
    } catch (error) {
      logger.error(`[${queueName}] Error sending notification`, {
        accountId,
        status,
        notificationType: notifications.type,
        error: error.message,
      });
      // Don't throw - notification failures shouldn't break job processing
    }
  }

  /**
   * Cleanup browser resources
   * @param {Object} job - Bull job instance
   */
  async function cleanupBrowser(job) {
    if (!browserCleanup) {
      return;
    }

    try {
      const puppeteerManager = PuppeteerManager.getInstance();
      if (puppeteerManager) {
        logger.info(`[${queueName}] Closing browser after job completion`, {
          jobId: job.id,
          accountId: getAccountId(job.data),
        });
        await puppeteerManager.closeBrowser();
      }
    } catch (browserError) {
      logger.warn(`[${queueName}] Error closing browser after job completion`, {
        error: browserError.message,
        jobId: job.id,
      });
      // Don't throw - browser cleanup failure shouldn't fail the job
    }
  }

  /**
   * Setup queue processor with common patterns
   */
  function setupQueueProcessor() {
    queue.process(concurrency, async (job) => {
      const accountId = getAccountId(job.data);

      // CRITICAL: Check if we can process BEFORE doing anything else
      // This prevents race conditions where multiple jobs start simultaneously
      if (!queueStateManager.canProcess) {
        logger.warn(
          `[${queueName}] Job ${job.id} cannot start - another job is already processing`,
          {
            jobId: job.id,
            accountId: accountId,
            currentJob: queueStateManager.currentJob,
            queueName: queueName,
          }
        );
        // Throw error to let Bull retry this job later
        throw new Error(
          `Cannot process job - another job is already running: ${queueStateManager.currentJob}`
        );
      }

      // Immediately set canProcess to false to prevent other jobs from starting
      // This must happen BEFORE pausing other queues to prevent race conditions
      queueStateManager.canProcess = false;
      queueStateManager.currentJob = queueName;
      queueStateManager.pauseStartTime = Date.now();

      // Send Slack notification if configured
      if (slackJobStartNotification) {
        try {
          await notifyJobStart(queueName, job);
        } catch (error) {
          logger.error(`[${queueName}] Error sending Slack job start notification`, {
            error: error.message,
            jobId: job.id,
          });
          // Continue processing even if notification fails
        }
      }

      // Now pause all other queues to prevent them from picking up new jobs
      await queueStateManager.pauseAllQueues(
        `Job started: ${queueName} (ID: ${job.id}, Account: ${accountId || 'UNKNOWN'})`,
        queueName
      );

      // Call onJobStart hook if provided
      if (onJobStart) {
        try {
          await onJobStart(job);
        } catch (error) {
          logger.error(`[${queueName}] Error in onJobStart hook`, {
            error: error.message,
            jobId: job.id,
          });
          // Continue processing even if hook fails
        }
      }

      try {
        // Process the job
        const result = await processor(job);

        // Call onJobComplete hook if provided
        if (onJobComplete) {
          try {
            await onJobComplete(job, result);
          } catch (error) {
            logger.error(`[${queueName}] Error in onJobComplete hook`, {
              error: error.message,
              jobId: job.id,
            });
            // Don't throw - hook failures shouldn't fail the job
          }
        }

        // Send success notification if configured
        if (accountId && notifications.onSuccess) {
          await sendNotification(accountId, 'completed');
        }

        return result;
      } catch (error) {
        // Call onJobError hook if provided
        if (onJobError) {
          try {
            await onJobError(job, error);
          } catch (hookError) {
            logger.error(`[${queueName}] Error in onJobError hook`, {
              error: hookError.message,
              jobId: job.id,
            });
            // Continue with error handling even if hook fails
          }
        }

        logger.error(`[${queueName}] Error processing job`, {
          jobId: job.id,
          accountId: accountId,
          error: error.message,
          stack: error.stack,
          jobData: job.data,
        });

        // Send failure notification if configured
        if (accountId && notifications.onFailure) {
          await sendNotification(accountId, 'failed', error.message);
        }

        // Re-throw to ensure queue error handling works
        throw error;
      } finally {
        // Always resume queues when done (even if error occurred)
        await queueStateManager.resumeAllQueues(
          `Job completed: ${queueName} (ID: ${job.id}, Account: ${accountId || 'UNKNOWN'})`
        );

        // Cleanup browser resources
        await cleanupBrowser(job);
      }
    });
  }

  /**
   * Setup failed event listener
   */
  function setupFailedListener() {
    if (!eventListeners.failed) {
      return;
    }

    queue.on("failed", async (job, error) => {
      const accountId = getAccountId(job.data);

      // Call custom failed handler hook if provided (allows custom logic like stalled handling)
      if (onFailed) {
        try {
          const handled = await onFailed(job, error);
          // If hook returns true, skip default handling
          if (handled === true) {
            return;
          }
        } catch (hookError) {
          logger.error(`[${queueName}] Error in onFailed hook`, {
            error: hookError.message,
            jobId: job.id,
          });
          // Continue with default handling even if hook fails
        }
      }

      // Handle queue error if configured
      if (queueErrorHandlerName) {
        queueErrorHandler(queueErrorHandlerName)(job, error);
      } else {
        // Default error logging
        logger.error(`[${queueName}] Job failed`, {
          jobId: job.id,
          accountId: accountId,
          error: error.message,
          stack: error.stack,
        });
      }

      // Safety net: Ensure queues are resumed even if finally block didn't run
      try {
        await queueStateManager.resumeAllQueues(
          `Job failed: ${queueName} (ID: ${job.id}, Account: ${accountId || 'UNKNOWN'})`
        );
      } catch (resumeError) {
        logger.error(`[${queueName}] Error resuming queues in failed handler`, {
          error: resumeError.message,
          jobId: job.id,
        });
      }

      // Send failure notification if configured
      if (accountId && notifications.onFailure) {
        await sendNotification(accountId, 'failed', error.message);
      } else if (!accountId) {
        logger.error(`[${queueName}] No account ID available for notification on job failure`, {
          jobId: job.id,
          jobData: job.data,
        });
      }
    });
  }

  /**
   * Setup completed event listener
   */
  function setupCompletedListener() {
    if (!eventListeners.completed) {
      return;
    }

    queue.on("completed", async (job, result) => {
      const accountId = getAccountId(job.data);
      const accountPath = job.data?.getSync?.PATH;

      // Validate account data before proceeding
      if (!accountId) {
        logger.error(`[${queueName}] CRITICAL: No account ID found in completed job data`, {
          jobId: job.id,
          jobData: job.data,
          getSync: job.data?.getSync,
        });
        return;
      }

      logger.info(`[${queueName}] Job completed successfully`, {
        jobId: job.id,
        accountId: accountId,
        accountPath: accountPath,
        result: result,
      });

      // Send success notification if configured (backup notification)
      // Note: Processor may also notify, but this ensures notification even if processor doesn't
      if (notifications.onSuccess) {
        await sendNotification(accountId, 'completed');
      }
    });
  }

  /**
   * Setup stalled event listener
   */
  function setupStalledListener() {
    if (!eventListeners.stalled) {
      return;
    }

    queue.on("stalled", (jobId) => {
      logger.info(`[${queueName}] Job detected as stalled (still processing)`, {
        jobId: jobId,
        message: "Job is taking longer than expected but still processing. This is normal for long-running jobs.",
      });
    });
  }

  /**
   * Process test data directly (bypasses queue)
   * @param {Object} testData - Test job data
   */
  async function processTestData(testData) {
    const accountId = getAccountId(testData);

    try {
      // Create a mock job object for test data
      const mockJob = {
        id: 'test',
        data: testData,
      };

      // Call onJobStart hook if provided
      if (onJobStart) {
        await onJobStart(mockJob);
      }

      // Process the test data
      const result = await processor(mockJob);

      // Call onJobComplete hook if provided
      if (onJobComplete) {
        await onJobComplete(mockJob, result);
      }

      // Send success notification if configured
      if (accountId && notifications.onSuccess) {
        await sendNotification(accountId, 'completed');
      }

      logger.info(`[${queueName}] Test data processed successfully`, {
        accountId: accountId,
      });

      return result;
    } catch (error) {
      // Call onJobError hook if provided
      if (onJobError) {
        await onJobError({ id: 'test', data: testData }, error);
      }

      logger.error(`[${queueName}] Error processing test data`, {
        accountId: accountId,
        error: error.message,
        stack: error.stack,
      });

      // Send failure notification if configured
      if (accountId && notifications.onFailure) {
        await sendNotification(accountId, 'failed', error.message);
      }

      // Re-throw to maintain original error behavior
      throw error;
    }
  }

  // Setup all event listeners
  setupFailedListener();
  setupCompletedListener();
  setupStalledListener();

  // Setup queue processor
  setupQueueProcessor();

  // Return handler function
  if (testDataSupport) {
    /**
     * Queue handler function with test data support
     * @param {Object} [testData=null] - Optional test data for direct processing
     */
    return async function handler(testData = null) {
      if (testData) {
        // For testing: process the test data directly
        return await processTestData(testData);
      }
      // Normal mode: queue processor is already setup, nothing to do
      logger.debug(`[${queueName}] Queue handler setup complete (normal mode)`);
    };
  } else {
    /**
     * Queue handler function (normal mode only)
     */
    return async function handler() {
      logger.debug(`[${queueName}] Queue handler setup complete`);
    };
  }
}

module.exports = setupQueueHandler;

