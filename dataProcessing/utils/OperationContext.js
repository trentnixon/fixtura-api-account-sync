/**
 * OperationContext - Provides correlation IDs and context for operations
 * Improves error messages and debugging by tracking operations with unique IDs
 */

const logger = require("../../src/utils/logger");

class OperationContext {
  /**
   * Create a new operation context
   * @param {string} operationType - Type of operation (e.g., 'scrapeCompetitions', 'processGames')
   * @param {string} stage - Stage of processing (e.g., 'competitions', 'games', 'validation')
   * @param {Object} initialData - Initial context data to include in all logs
   */
  constructor(operationType, stage, initialData = {}) {
    this.id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.operationType = operationType;
    this.stage = stage;
    this.startTime = Date.now();
    this.initialData = initialData;
  }

  /**
   * Get base context object for logging
   * @private
   */
  _getBaseContext(additionalData = {}) {
    return {
      operationId: this.id,
      operationType: this.operationType,
      stage: this.stage,
      duration: Date.now() - this.startTime,
      ...this.initialData,
      ...additionalData,
    };
  }

  /**
   * Log an info message with context
   * @param {string} message - Log message
   * @param {Object} data - Additional data to include
   */
  log(message, data = {}) {
    logger.info(message, this._getBaseContext(data));
  }

  /**
   * Log a debug message with context
   * @param {string} message - Log message
   * @param {Object} data - Additional data to include
   */
  debug(message, data = {}) {
    logger.debug(message, this._getBaseContext(data));
  }

  /**
   * Log a warning message with context
   * @param {string} message - Log message
   * @param {Object} data - Additional data to include
   */
  warn(message, data = {}) {
    logger.warn(message, this._getBaseContext(data));
  }

  /**
   * Log an error message with context
   * @param {string} message - Error message
   * @param {Error} error - Error object (optional)
   * @param {Object} data - Additional data to include
   */
  error(message, error = null, data = {}) {
    const errorData = {
      ...data,
    };

    if (error) {
      errorData.error = error.message;
      errorData.errorName = error.name;
      errorData.stack = error.stack;
      errorData.errorCode = error.code;
    }

    logger.error(message, this._getBaseContext(errorData));
  }

  /**
   * Create a child context for nested operations
   * @param {string} subStage - Sub-stage name
   * @param {Object} additionalData - Additional data for child context
   * @returns {OperationContext} New child context
   */
  createChild(subStage, additionalData = {}) {
    const child = new OperationContext(
      this.operationType,
      `${this.stage}.${subStage}`,
      {
        ...this.initialData,
        parentOperationId: this.id,
        ...additionalData,
      }
    );
    return child;
  }

  /**
   * Get current context summary
   * @returns {Object} Context summary
   */
  getSummary() {
    return {
      operationId: this.id,
      operationType: this.operationType,
      stage: this.stage,
      duration: Date.now() - this.startTime,
      ...this.initialData,
    };
  }
}

module.exports = OperationContext;

