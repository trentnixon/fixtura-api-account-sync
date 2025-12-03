const dotenv = require("dotenv");
const result = dotenv.config();

const ENVIRONMENT = (process.env.NODE_ENV || "").trim();

if (!ENVIRONMENT) {
  if (result.error) {
    console.log(result.error);
    throw new Error(
      "[environment.js] Failed to load '.env' file: " + result.error
    );
  }
  throw new Error(
    "[environment.js] NODE_ENV is not set. Please set NODE_ENV to 'development' or 'production'."
  );
}

// Validate required environment variables
const requiredEnvVars = ["FIXTURA_TOKEN"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(
    `[environment.js] Warning: Missing required environment variables: ${missingVars.join(
      ", "
    )}`
  );
  console.warn(
    `[environment.js] Some features may not work correctly without these variables.`
  );
}

// API Configuration
const API_CONFIG = {
  baseUrl: process.env.FIXTURA_API || "http://127.0.0.1:1337",
  token: process.env.FIXTURA_TOKEN,
  timeout: parseInt(process.env.API_TIMEOUT) || 30000,
  retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS) || 3,
};

// Admin Account Configuration for Direct Org Processing
const ADMIN_CONFIG = {
  accountId: process.env.ADMIN_ACCOUNT_ID
    ? parseInt(process.env.ADMIN_ACCOUNT_ID, 10)
    : null,
};

// Proxy Configuration (Decodo)
// Support multiple ports: can be single "host:port" or comma-separated ports "host:port1,port2,port3"
const { buildProxyConfig } = require("./proxyConfig");
const { logAllConfig } = require("../utils/configLogger");

const PROXY_CONFIG = buildProxyConfig(process.env);

// Parallel Processing Configuration
// Strategy 1: Parallel Page Processing - controls concurrency and page pool size
const PARALLEL_CONFIG = {
  pagePoolSize: parseInt(process.env.PARALLEL_PAGE_POOL_SIZE || "3", 10),
  competitionsConcurrency: parseInt(
    process.env.PARALLEL_COMPETITIONS_CONCURRENCY || "3",
    10
  ),
  teamsConcurrency: parseInt(
    process.env.PARALLEL_TEAMS_CONCURRENCY || "3",
    10
  ),
  validationConcurrency: parseInt(
    process.env.PARALLEL_VALIDATION_CONCURRENCY || "5",
    10
  ),
};

// Validate configurations
const { validateConfigs } = require("../../dataProcessing/puppeteer/configValidator");

try {
  // Import constants for validation
  const {
    PARALLEL_CONFIG: PUPPETEER_PARALLEL_CONFIG,
    MEMORY_CONFIG,
    BROWSER_CONFIG,
  } = require("../../dataProcessing/puppeteer/constants");

  // Validate all configurations
  validateConfigs({
    parallel: PUPPETEER_PARALLEL_CONFIG,
    memory: MEMORY_CONFIG,
    browser: BROWSER_CONFIG,
    proxy: PROXY_CONFIG,
    api: API_CONFIG,
  });
} catch (error) {
  // Log error but don't throw - allows graceful degradation
  // The error will be caught and logged, but application startup continues
  const logger = require("../utils/logger");
  logger.error("[environment.js] Configuration validation failed", {
    error: error.message,
    note: "Application may continue with invalid configuration",
  });
}

// Log all configuration
logAllConfig({
  environment: ENVIRONMENT,
  api: API_CONFIG,
  admin: ADMIN_CONFIG,
  proxy: PROXY_CONFIG,
  parallel: PARALLEL_CONFIG,
});

module.exports = {
  ENVIRONMENT,
  API_CONFIG,
  ADMIN_CONFIG,
  PROXY_CONFIG,
  PARALLEL_CONFIG,
  isDevelopment: ENVIRONMENT === "development",
  isProduction: ENVIRONMENT === "production",
};
