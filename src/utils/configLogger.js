/**
 * Configuration Logger
 * Centralized logging for environment configuration
 */

const {
  isProxyConfigValid,
  getProxyConfigDisplay,
} = require("../config/proxyConfig");

/**
 * Log environment configuration
 * @param {Object} config - Environment configuration
 */
const logEnvironment = (config) => {
  console.log(`[environment.js] Environment: ${config.environment}`);
  console.log(`[environment.js] API Base URL: ${config.api.baseUrl}`);
  console.log(`[environment.js] API Timeout: ${config.api.timeout}ms`);
  console.log(
    `[environment.js] API Retry Attempts: ${config.api.retryAttempts}`
  );
};

/**
 * Log admin configuration
 * @param {Object} config - Admin configuration
 */
const logAdminConfig = (config) => {
  if (config.accountId) {
    console.log(
      `[environment.js] Admin Account ID: ${config.accountId} (for direct org processing)`
    );
  } else {
    console.log(
      `[environment.js] Admin Account ID: Not set (direct org processing will use null account ID)`
    );
  }
};

/**
 * Log proxy configuration
 * @param {Object} config - Proxy configuration
 */
const logProxyConfig = (config) => {
  if (isProxyConfigValid(config)) {
    const display = getProxyConfigDisplay(config);
    const portRange = config.portRange
      ? `Ports ${config.portRange.start}-${config.portRange.end} (${config.ports.length} total)`
      : `${config.ports.length} ports`;
    console.log(`[environment.js] Decodo Proxy: Enabled (${display})`);
    console.log(`[environment.js] Decodo Proxy Port Range: ${portRange}`);
  } else {
    console.log(`[environment.js] Decodo Proxy: Disabled`);
  }
};

/**
 * Log parallel processing configuration
 * @param {Object} config - Parallel processing configuration
 */
const logParallelConfig = (config) => {
  console.log(
    `[environment.js] Parallel Processing: Page Pool Size=${config.pagePoolSize}, Competitions=${config.competitionsConcurrency}, Teams=${config.teamsConcurrency}, Validation=${config.validationConcurrency}`
  );
};

/**
 * Log all configuration
 * @param {Object} envConfig - Complete environment configuration
 */
const logAllConfig = (envConfig) => {
  logEnvironment(envConfig);
  logAdminConfig(envConfig.admin);
  logProxyConfig(envConfig.proxy);
  if (envConfig.parallel) {
    logParallelConfig(envConfig.parallel);
  }
};

module.exports = {
  logEnvironment,
  logAdminConfig,
  logProxyConfig,
  logAllConfig,
};
