const logger = require("./src/utils/logger");
const queueStateManager = require("./src/utils/queueStateManager");
const queueMonitoringService = require("./src/queues/queueMonitoringService");
const {
  startAssetBundleCreation,
  syncUserAccount,
  onboardNewAccount,
  updateAccountOnly,
  syncClubDirect,
  syncAssociationDirect,
} = require("./src/config/queueConfig");

// Queue handlers
const queueHandlers = [
  {
    handler: require("./src/queues/checkAssetGeneratorAccountStatus"),
    name: "checkAssetGeneratorAccountStatus",
  },
  {
    handler: require("./src/queues/syncUserAccountQueue"),
    name: "syncUserAccountQueue",
  },
  {
    handler: require("./src/queues/onboardNewAccount"),
    name: "onboardNewAccount",
  },
  {
    handler: require("./src/queues/updateAccountOnlyQueue"),
    name: "updateAccountOnlyQueue",
  },
  {
    handler: require("./src/queues/syncClubDirectQueue"),
    name: "syncClubDirectQueue",
  },
  {
    handler: require("./src/queues/syncAssociationDirectQueue"),
    name: "syncAssociationDirectQueue",
  },
];

// Queue registration configuration
const queueRegistrations = [
  { queue: startAssetBundleCreation, name: "startAssetBundleCreation" },
  { queue: syncUserAccount, name: "syncUserAccount" },
  { queue: onboardNewAccount, name: "onboardNewAccount" },
  { queue: updateAccountOnly, name: "updateAccountOnly" },
  { queue: syncClubDirect, name: "syncClubDirect" },
  { queue: syncAssociationDirect, name: "syncAssociationDirect" },
];

/**
 * Initialize a single queue handler with error handling
 * @param {Function} handler - Queue handler function
 * @param {string} name - Handler name for logging
 */
async function initializeQueueHandler(handler, name) {
  try {
    logger.debug(`[Worker] Initializing queue handler: ${name}`);
    await handler();
    logger.debug(`[Worker] Queue handler initialized: ${name}`);
  } catch (error) {
    logger.error(`[Worker] Error initializing queue handler: ${name}`, {
      error: error.message,
      stack: error.stack,
      handlerName: name,
    });
    // Don't throw - allow other handlers to initialize even if one fails
  }
}

/**
 * Register all queues with the state manager
 */
async function registerQueuesWithStateManager() {
  logger.info("[Worker] Registering queues with state manager");

  try {
    for (const { queue, name } of queueRegistrations) {
      queueStateManager.registerQueue(queue, name);
    }

    queueStateManager.markInitialized();

    // Check and recover from any stuck pause states on startup
    await queueStateManager.checkAndRecoverOnStartup();

    logger.info("[Worker] All queues registered with state manager", {
      state: queueStateManager.getState(),
      registeredQueues: queueRegistrations.length,
    });
  } catch (error) {
    logger.error("[Worker] Error registering queues with state manager", {
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw as this is critical for operation
  }
}

/**
 * Initialize all queue processing handlers
 */
async function initializeQueueProcessing() {
  logger.info("[Worker] Initializing queue processing");

  // Initialize all queue handlers in parallel for faster startup
  const initializationPromises = queueHandlers.map(({ handler, name }) =>
    initializeQueueHandler(handler, name)
  );

  await Promise.allSettled(initializationPromises);

  logger.info("[Worker] Queue processing initialization complete");

  // Register queues with state manager
  await registerQueuesWithStateManager();

  // Initialize and start queue monitoring service
  try {
    const queues = {
      startAssetBundleCreation,
      syncUserAccount,
      onboardNewAccount,
      updateAccountOnly,
      syncClubDirect,
      syncAssociationDirect,
    };

    queueMonitoringService.initialize(queues);
    queueMonitoringService.start();

    logger.info("[Worker] Queue monitoring service started");
  } catch (error) {
    logger.error("[Worker] Error starting queue monitoring service", {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - monitoring failure shouldn't prevent worker from starting
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`[Worker] Received ${signal}, initiating graceful shutdown`);

  try {
    // Stop queue monitoring service (stops all intervals)
    if (queueMonitoringService.isRunning) {
      logger.info("[Worker] Stopping queue monitoring service");
      queueMonitoringService.stop();
    }

    // Add any other cleanup logic here if needed
    // e.g., closing database connections, etc.

    logger.info("[Worker] Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("[Worker] Error during graceful shutdown", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Register signal handlers for graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("[Worker] Unhandled promise rejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("[Worker] Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
  // Exit after logging as the process is in an undefined state
  process.exit(1);
});

// Start queue processing
initializeQueueProcessing().catch((error) => {
  logger.error("[Worker] Fatal error initializing queue processing", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

logger.info("[Worker] Worker started successfully");
