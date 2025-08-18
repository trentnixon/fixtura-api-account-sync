/**
 * Configuration for smart backoff strategy in ladder table detection
 *
 * This configuration allows fine-tuning of the backoff behavior:
 * - initialDelay: How long to wait on the first attempt
 * - maxDelay: Maximum delay cap to prevent excessive waiting
 * - backoffMultiplier: How much to increase delay between attempts
 * - maxAttempts: Total number of attempts before giving up
 * - quickCheckDelay: Very fast initial check for already-loaded content
 */

const backoffConfig = {
  // Fast strategy - for speed-critical scenarios
  fast: {
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    maxAttempts: 3,
    quickCheckDelay: 200,
  },

  // Balanced strategy - general use (default)
  balanced: {
    initialDelay: 2000, // Increased from 1000ms
    maxDelay: 15000, // Increased from 10000ms
    backoffMultiplier: 1.8, // Increased from 1.5
    maxAttempts: 4, // Increased from 3
    quickCheckDelay: 1000, // Increased from 500ms
  },

  // Conservative strategy - maximum reliability
  conservative: {
    initialDelay: 3000,
    maxDelay: 20000,
    backoffMultiplier: 2.0,
    maxAttempts: 5,
    quickCheckDelay: 1500,
  },

  // Aggressive strategy - for speed-critical scenarios
  aggressive: {
    initialDelay: 300,
    maxDelay: 3000,
    backoffMultiplier: 1.3,
    maxAttempts: 2,
    quickCheckDelay: 100,
  },
};

// Default configuration
const defaultConfig = backoffConfig.balanced;

// Environment-based configuration
const getConfig = () => {
  const env = process.env.SCRAPER_BACKOFF_STRATEGY || "balanced";
  return backoffConfig[env] || defaultConfig;
};

// Performance metrics tracking
const performanceMetrics = {
  totalAttempts: 0,
  successfulAttempts: 0,
  averageAttemptsPerPage: 0,
  pagesProcessed: 0,

  recordAttempt(successful, attempts) {
    this.totalAttempts += attempts;
    this.pagesProcessed++;
    if (successful) {
      this.successfulAttempts++;
    }
    this.averageAttemptsPerPage = this.totalAttempts / this.pagesProcessed;
  },

  getStats() {
    return {
      totalAttempts: this.totalAttempts,
      successfulAttempts: this.successfulAttempts,
      averageAttemptsPerPage: this.averageAttemptsPerPage,
      pagesProcessed: this.pagesProcessed,
      successRate:
        this.pagesProcessed > 0
          ? (this.successfulAttempts / this.pagesProcessed) * 100
          : 0,
    };
  },

  reset() {
    this.totalAttempts = 0;
    this.successfulAttempts = 0;
    this.averageAttemptsPerPage = 0;
    this.pagesProcessed = 0;
  },
};

module.exports = {
  backoffConfig,
  getConfig,
  performanceMetrics,
  defaultConfig,
};
