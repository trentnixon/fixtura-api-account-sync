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
// MEMORY FIX: More aggressive restart thresholds for 2GB instances
const MEMORY_CONFIG = {
  MAX_OPERATIONS_BEFORE_RESTART: parseInt(
    process.env.PUPPETEER_MAX_OPS_BEFORE_RESTART || "75", // Reduced from 150 to 75 for more frequent restarts
    10
  ),
  MIN_RESTART_INTERVAL: 60000, // 60 seconds (1 minute) - reduced from 120s for more frequent restarts
  MEMORY_LOG_INTERVAL: 20, // Log memory every 20 operations (reduced frequency from 10)
  MEMORY_CHECK_INTERVAL: 10, // Check memory every 10 operations (reduced frequency from 5)
  // Memory thresholds - kept conservative for 2GB server
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

// Parallel Processing Configuration
// Strategy 1: Parallel Page Processing
// PERFORMANCE FIX: PAGE_POOL_SIZE must be >= max concurrency to prevent waiting
// If pool size < concurrency, tasks wait for pages instead of processing in parallel
const PARALLEL_CONFIG = {
  COMPETITIONS_CONCURRENCY: parseInt(
    process.env.PARALLEL_COMPETITIONS_CONCURRENCY || "2", // Reduced from 3 to 2
    10
  ), // Default: 2 concurrent associations (reduced for memory)
  TEAMS_CONCURRENCY: parseInt(
    process.env.PARALLEL_TEAMS_CONCURRENCY || "2", // Reduced from 3 to 2
    10
  ), // Default: 2 concurrent teams (reduced for memory)
  VALIDATION_CONCURRENCY: parseInt(
    process.env.PARALLEL_VALIDATION_CONCURRENCY || "3", // Reduced from 5 to 3
    10
  ), // Default: 3 concurrent validations (reduced for memory)
};

// Calculate PAGE_POOL_SIZE dynamically to match max concurrency
// This ensures pool size is always >= highest concurrency value
const maxConcurrency = Math.max(
  PARALLEL_CONFIG.COMPETITIONS_CONCURRENCY,
  PARALLEL_CONFIG.TEAMS_CONCURRENCY,
  PARALLEL_CONFIG.VALIDATION_CONCURRENCY
);

PARALLEL_CONFIG.PAGE_POOL_SIZE = parseInt(
  process.env.PARALLEL_PAGE_POOL_SIZE || String(maxConcurrency),
  10
); // Default: matches max concurrency (ensures no waiting)

// Ensure PAGE_POOL_SIZE is at least max concurrency (even if env var is set lower)
if (PARALLEL_CONFIG.PAGE_POOL_SIZE < maxConcurrency) {
  PARALLEL_CONFIG.PAGE_POOL_SIZE = maxConcurrency;
}

// Environment Detection
const isDevelopment = () => {
  return process.env.NODE_ENV && process.env.NODE_ENV.trim() === "development";
};

module.exports = {
  BROWSER_CONFIG,
  MEMORY_CONFIG,
  PAGE_CONFIG,
  BLOCKED_RESOURCE_TYPES,
  PARALLEL_CONFIG,
  isDevelopment,
};
