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

// Log all configuration
logAllConfig({
  environment: ENVIRONMENT,
  api: API_CONFIG,
  admin: ADMIN_CONFIG,
  proxy: PROXY_CONFIG,
});

module.exports = {
  ENVIRONMENT,
  API_CONFIG,
  ADMIN_CONFIG,
  PROXY_CONFIG,
  isDevelopment: ENVIRONMENT === "development",
  isProduction: ENVIRONMENT === "production",
};
