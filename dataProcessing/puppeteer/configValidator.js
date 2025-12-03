/**
 * Configuration Validator
 * Validates all configuration settings at startup to catch errors early
 */

const logger = require("../../src/utils/logger");

/**
 * Validate parallel processing configuration
 * @param {Object} config - PARALLEL_CONFIG object
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
function validateParallelConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate PAGE_POOL_SIZE
  if (
    typeof config.PAGE_POOL_SIZE !== "number" ||
    config.PAGE_POOL_SIZE < 1 ||
    config.PAGE_POOL_SIZE > 20
  ) {
    errors.push(
      `PAGE_POOL_SIZE must be a number between 1 and 20, got ${config.PAGE_POOL_SIZE}`
    );
  }

  // Validate COMPETITIONS_CONCURRENCY
  if (
    typeof config.COMPETITIONS_CONCURRENCY !== "number" ||
    config.COMPETITIONS_CONCURRENCY < 1 ||
    config.COMPETITIONS_CONCURRENCY > 10
  ) {
    errors.push(
      `COMPETITIONS_CONCURRENCY must be a number between 1 and 10, got ${config.COMPETITIONS_CONCURRENCY}`
    );
  }

  // Validate TEAMS_CONCURRENCY
  if (
    typeof config.TEAMS_CONCURRENCY !== "number" ||
    config.TEAMS_CONCURRENCY < 1 ||
    config.TEAMS_CONCURRENCY > 10
  ) {
    errors.push(
      `TEAMS_CONCURRENCY must be a number between 1 and 10, got ${config.TEAMS_CONCURRENCY}`
    );
  }

  // Validate VALIDATION_CONCURRENCY
  if (
    typeof config.VALIDATION_CONCURRENCY !== "number" ||
    config.VALIDATION_CONCURRENCY < 1 ||
    config.VALIDATION_CONCURRENCY > 20
  ) {
    errors.push(
      `VALIDATION_CONCURRENCY must be a number between 1 and 20, got ${config.VALIDATION_CONCURRENCY}`
    );
  }

  // Warn if concurrency > pool size (will cause waiting)
  if (config.COMPETITIONS_CONCURRENCY > config.PAGE_POOL_SIZE) {
    warnings.push(
      `COMPETITIONS_CONCURRENCY (${config.COMPETITIONS_CONCURRENCY}) > PAGE_POOL_SIZE (${config.PAGE_POOL_SIZE}) - may cause waiting for pages`
    );
  }

  if (config.TEAMS_CONCURRENCY > config.PAGE_POOL_SIZE) {
    warnings.push(
      `TEAMS_CONCURRENCY (${config.TEAMS_CONCURRENCY}) > PAGE_POOL_SIZE (${config.PAGE_POOL_SIZE}) - may cause waiting for pages`
    );
  }

  if (config.VALIDATION_CONCURRENCY > config.PAGE_POOL_SIZE) {
    warnings.push(
      `VALIDATION_CONCURRENCY (${config.VALIDATION_CONCURRENCY}) > PAGE_POOL_SIZE (${config.PAGE_POOL_SIZE}) - may cause waiting for pages`
    );
  }

  return { errors, warnings };
}

/**
 * Validate memory configuration
 * @param {Object} config - MEMORY_CONFIG object
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
function validateMemoryConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate MAX_OPERATIONS_BEFORE_RESTART
  if (
    typeof config.MAX_OPERATIONS_BEFORE_RESTART !== "number" ||
    config.MAX_OPERATIONS_BEFORE_RESTART < 1 ||
    config.MAX_OPERATIONS_BEFORE_RESTART > 1000
  ) {
    errors.push(
      `MAX_OPERATIONS_BEFORE_RESTART must be between 1 and 1000, got ${config.MAX_OPERATIONS_BEFORE_RESTART}`
    );
  }

  // Validate MIN_RESTART_INTERVAL
  if (
    typeof config.MIN_RESTART_INTERVAL !== "number" ||
    config.MIN_RESTART_INTERVAL < 1000 ||
    config.MIN_RESTART_INTERVAL > 600000
  ) {
    errors.push(
      `MIN_RESTART_INTERVAL must be between 1000ms (1s) and 600000ms (10min), got ${config.MIN_RESTART_INTERVAL}`
    );
  }

  // Validate memory thresholds
  if (
    typeof config.HEAP_THRESHOLD_MB !== "number" ||
    config.HEAP_THRESHOLD_MB < 50 ||
    config.HEAP_THRESHOLD_MB > 2000
  ) {
    errors.push(
      `HEAP_THRESHOLD_MB must be between 50 and 2000, got ${config.HEAP_THRESHOLD_MB}`
    );
  }

  if (
    typeof config.RSS_THRESHOLD_MB !== "number" ||
    config.RSS_THRESHOLD_MB < 100 ||
    config.RSS_THRESHOLD_MB > 4000
  ) {
    errors.push(
      `RSS_THRESHOLD_MB must be between 100 and 4000, got ${config.RSS_THRESHOLD_MB}`
    );
  }

  // Warn if warning thresholds are higher than restart thresholds
  if (config.MEMORY_WARNING_HEAP_MB >= config.HEAP_THRESHOLD_MB) {
    warnings.push(
      `MEMORY_WARNING_HEAP_MB (${config.MEMORY_WARNING_HEAP_MB}) >= HEAP_THRESHOLD_MB (${config.HEAP_THRESHOLD_MB}) - warnings may not trigger before restart`
    );
  }

  if (config.MEMORY_WARNING_RSS_MB >= config.RSS_THRESHOLD_MB) {
    warnings.push(
      `MEMORY_WARNING_RSS_MB (${config.MEMORY_WARNING_RSS_MB}) >= RSS_THRESHOLD_MB (${config.RSS_THRESHOLD_MB}) - warnings may not trigger before restart`
    );
  }

  return { errors, warnings };
}

/**
 * Validate browser configuration
 * @param {Object} config - BROWSER_CONFIG object
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
function validateBrowserConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate PROTOCOL_TIMEOUT
  if (
    typeof config.PROTOCOL_TIMEOUT !== "number" ||
    config.PROTOCOL_TIMEOUT < 30000 ||
    config.PROTOCOL_TIMEOUT > 600000
  ) {
    errors.push(
      `PROTOCOL_TIMEOUT must be between 30000ms (30s) and 600000ms (10min), got ${config.PROTOCOL_TIMEOUT}`
    );
  }

  // Validate MAX_LISTENERS
  if (
    typeof config.MAX_LISTENERS !== "number" ||
    config.MAX_LISTENERS < 10 ||
    config.MAX_LISTENERS > 100
  ) {
    errors.push(
      `MAX_LISTENERS must be between 10 and 100, got ${config.MAX_LISTENERS}`
    );
  }

  return { errors, warnings };
}

/**
 * Validate proxy configuration
 * @param {Object} config - PROXY_CONFIG object
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
function validateProxyConfig(config) {
  const errors = [];
  const warnings = [];

  // If proxy is disabled, skip validation
  if (!config.enabled) {
    return { errors, warnings };
  }

  // Validate host
  if (!config.host || typeof config.host !== "string" || config.host.trim() === "") {
    errors.push("PROXY_CONFIG.host must be a non-empty string when proxy is enabled");
  }

  // Validate ports
  if (!Array.isArray(config.ports) || config.ports.length === 0) {
    errors.push("PROXY_CONFIG.ports must be a non-empty array when proxy is enabled");
  } else {
    // Validate port format
    const invalidPorts = config.ports.filter(
      (port) => typeof port !== "string" || isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535
    );
    if (invalidPorts.length > 0) {
      errors.push(
        `PROXY_CONFIG.ports contains invalid ports: ${invalidPorts.slice(0, 5).join(", ")}${invalidPorts.length > 5 ? "..." : ""}`
      );
    }
  }

  // Warn if credentials are missing when proxy is enabled
  if (!config.username || config.username.trim() === "") {
    warnings.push(
      "PROXY_CONFIG.username is missing or empty - proxy authentication may fail (HTTP 407)"
    );
  }

  if (!config.password || config.password.trim() === "") {
    warnings.push(
      "PROXY_CONFIG.password is missing or empty - proxy authentication may fail (HTTP 407)"
    );
  }

  return { errors, warnings };
}

/**
 * Validate API configuration
 * @param {Object} config - API_CONFIG object
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
function validateApiConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate timeout
  if (
    typeof config.timeout !== "number" ||
    config.timeout < 1000 ||
    config.timeout > 300000
  ) {
    errors.push(
      `API_CONFIG.timeout must be between 1000ms (1s) and 300000ms (5min), got ${config.timeout}`
    );
  }

  // Validate retryAttempts
  if (
    typeof config.retryAttempts !== "number" ||
    config.retryAttempts < 0 ||
    config.retryAttempts > 10
  ) {
    errors.push(
      `API_CONFIG.retryAttempts must be between 0 and 10, got ${config.retryAttempts}`
    );
  }

  // Warn if token is missing
  if (!config.token || config.token.trim() === "") {
    warnings.push("API_CONFIG.token is missing or empty - API requests may fail");
  }

  return { errors, warnings };
}

/**
 * Validate all configurations
 * @param {Object} configs - Object containing all config objects
 * @returns {Object} Validation result with errors and warnings
 */
function validateAllConfigs(configs) {
  const allErrors = [];
  const allWarnings = [];

  // Validate parallel config
  if (configs.parallel) {
    const { errors, warnings } = validateParallelConfig(configs.parallel);
    allErrors.push(...errors.map((e) => `[PARALLEL_CONFIG] ${e}`));
    allWarnings.push(...warnings.map((w) => `[PARALLEL_CONFIG] ${w}`));
  }

  // Validate memory config
  if (configs.memory) {
    const { errors, warnings } = validateMemoryConfig(configs.memory);
    allErrors.push(...errors.map((e) => `[MEMORY_CONFIG] ${e}`));
    allWarnings.push(...warnings.map((w) => `[MEMORY_CONFIG] ${w}`));
  }

  // Validate browser config
  if (configs.browser) {
    const { errors, warnings } = validateBrowserConfig(configs.browser);
    allErrors.push(...errors.map((e) => `[BROWSER_CONFIG] ${e}`));
    allWarnings.push(...warnings.map((w) => `[BROWSER_CONFIG] ${w}`));
  }

  // Validate proxy config
  if (configs.proxy) {
    const { errors, warnings } = validateProxyConfig(configs.proxy);
    allErrors.push(...errors.map((e) => `[PROXY_CONFIG] ${e}`));
    allWarnings.push(...warnings.map((w) => `[PROXY_CONFIG] ${w}`));
  }

  // Validate API config
  if (configs.api) {
    const { errors, warnings } = validateApiConfig(configs.api);
    allErrors.push(...errors.map((e) => `[API_CONFIG] ${e}`));
    allWarnings.push(...warnings.map((w) => `[API_CONFIG] ${w}`));
  }

  return { errors: allErrors, warnings: allWarnings };
}

/**
 * Validate configurations and throw if errors found
 * Logs warnings but continues execution
 * @param {Object} configs - Object containing all config objects
 * @throws {Error} If validation errors are found
 */
function validateConfigs(configs) {
  const { errors, warnings } = validateAllConfigs(configs);

  // Log warnings (non-fatal)
  if (warnings.length > 0) {
    logger.warn("[ConfigValidator] Configuration warnings detected:", {
      warnings,
      count: warnings.length,
    });
    warnings.forEach((warning) => {
      logger.warn(`[ConfigValidator] ${warning}`);
    });
  }

  // Throw errors (fatal)
  if (errors.length > 0) {
    const errorMessage = `[ConfigValidator] Invalid configuration detected:\n${errors.join("\n")}`;
    logger.error(errorMessage, {
      errors,
      count: errors.length,
    });
    throw new Error(errorMessage);
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.info("[ConfigValidator] All configurations validated successfully");
  } else if (errors.length === 0) {
    logger.info(
      `[ConfigValidator] Configuration validation completed with ${warnings.length} warning(s)`
    );
  }
}

module.exports = {
  validateParallelConfig,
  validateMemoryConfig,
  validateBrowserConfig,
  validateProxyConfig,
  validateApiConfig,
  validateAllConfigs,
  validateConfigs,
};

