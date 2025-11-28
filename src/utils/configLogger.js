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
    console.log(`[environment.js] Decodo Proxy: Enabled (${display})`);
  } else {
    console.log(`[environment.js] Decodo Proxy: Disabled`);
  }
};

/**
 * Log all configuration
 * @param {Object} envConfig - Complete environment configuration
 */
const logAllConfig = (envConfig) => {
  logEnvironment(envConfig);
  logAdminConfig(envConfig.admin);
  logProxyConfig(envConfig.proxy);
};

module.exports = {
  logEnvironment,
  logAdminConfig,
  logProxyConfig,
  logAllConfig,
};
