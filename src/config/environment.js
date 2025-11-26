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

// Log configuration for debugging
console.log(`[environment.js] Environment: ${ENVIRONMENT}`);
console.log(`[environment.js] API Base URL: ${API_CONFIG.baseUrl}`);
console.log(`[environment.js] API Timeout: ${API_CONFIG.timeout}ms`);
console.log(`[environment.js] API Retry Attempts: ${API_CONFIG.retryAttempts}`);

// Log admin config if set
if (ADMIN_CONFIG.accountId) {
  console.log(
    `[environment.js] Admin Account ID: ${ADMIN_CONFIG.accountId} (for direct org processing)`
  );
} else {
  console.log(
    `[environment.js] Admin Account ID: Not set (direct org processing will use null account ID)`
  );
}

module.exports = {
  ENVIRONMENT,
  API_CONFIG,
  ADMIN_CONFIG,
  isDevelopment: ENVIRONMENT === "development",
  isProduction: ENVIRONMENT === "production",
};
