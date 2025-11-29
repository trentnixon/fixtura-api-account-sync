/**
 * Puppeteer Configuration Constants
 * Centralized configuration for PuppeteerManager and related utilities
 */

// Browser Launch Configuration
const BROWSER_CONFIG = {
  PROTOCOL_TIMEOUT: 120000, // 2 minutes
  MAX_LISTENERS: 20, // EventEmitter max listeners
  RESTART_DELAY: 1000, // 1 second delay before restart
};

// Memory Management Configuration
// Updated for 2GB server - relaxed thresholds for better performance
const MEMORY_CONFIG = {
  MAX_OPERATIONS_BEFORE_RESTART: parseInt(
    process.env.PUPPETEER_MAX_OPS_BEFORE_RESTART || "150", // Increased from 75 for 2GB server
    10
  ),
  MIN_RESTART_INTERVAL: 120000, // 120 seconds (2 minutes) - increased from 60s for 2GB server
  MEMORY_LOG_INTERVAL: 20, // Log memory every 20 operations (reduced frequency from 10)
  MEMORY_CHECK_INTERVAL: 10, // Check memory every 10 operations (reduced frequency from 5)
  // Memory thresholds - increased for 2GB server
  HEAP_THRESHOLD_MB: 300, // Increased from 150
  RSS_THRESHOLD_MB: 800, // Increased from 400
  MEMORY_WARNING_HEAP_MB: 200, // Increased from 100
  MEMORY_WARNING_RSS_MB: 600, // Increased from 300
};

// Page Configuration
const PAGE_CONFIG = {
  viewport: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  navigationTimeout: 15000, // 15 seconds - reduced from 30s for faster failure detection
  defaultTimeout: 15000, // 15 seconds
};

// Resource Types to Block by Default
const BLOCKED_RESOURCE_TYPES = [
  "font", // Fonts not needed for data extraction
  "media", // Videos/audio not needed
  "websocket", // WebSockets not needed
  "manifest", // App manifests not needed
  // Note: Images and stylesheets are allowed (some sites need them for proper rendering)
];

// Environment Detection
const isDevelopment = () => {
  return process.env.NODE_ENV && process.env.NODE_ENV.trim() === "development";
};

module.exports = {
  BROWSER_CONFIG,
  MEMORY_CONFIG,
  PAGE_CONFIG,
  BLOCKED_RESOURCE_TYPES,
  isDevelopment,
};
