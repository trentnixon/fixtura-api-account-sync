/**
 * Page Setup Utilities
 * Centralized page configuration and setup logic
 */

const logger = require("../../src/utils/logger");
const { PAGE_CONFIG, BLOCKED_RESOURCE_TYPES } = require("./constants");

/**
 * Configure page with default settings
 * @param {Page} page - Puppeteer page object
 */
const configurePage = async (page) => {
  // Set default timeouts
  page.setDefaultNavigationTimeout(PAGE_CONFIG.navigationTimeout);
  page.setDefaultTimeout(PAGE_CONFIG.defaultTimeout);

  // Set viewport
  await page.setViewport(PAGE_CONFIG.viewport);

  // Set user agent
  await page.setUserAgent(PAGE_CONFIG.userAgent);

  // Enable JavaScript
  await page.setJavaScriptEnabled(true);
};

/**
 * Set up request interception to block non-essential resources
 * @param {Page} page - Puppeteer page object
 * @returns {boolean} True if interception was set up successfully
 */
const setupRequestInterception = async (page) => {
  try {
    // Check if request interception is already enabled
    if (page.listenerCount("request") > 0) {
      logger.debug("Request interception already enabled, skipping setup");
      return false;
    }

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    return true;
  } catch (error) {
    logger.debug("Request interception setup failed (may already be set)", {
      error: error.message,
    });
    return false;
  }
};

/**
 * Authenticate page with proxy credentials
 * @param {Page} page - Puppeteer page object
 * @param {Object} proxyConfig - Proxy configuration with username and password
 * @returns {boolean} True if authentication was successful
 */
const authenticateProxy = async (page, proxyConfig) => {
  // Check exactly like dependencies.js - must have username AND password (not empty strings)
  if (
    !proxyConfig ||
    !proxyConfig.username ||
    !proxyConfig.password ||
    proxyConfig.username.trim() === "" ||
    proxyConfig.password.trim() === ""
  ) {
    return false;
  }

  try {
    // EXACTLY like dependencies.js (production) - NO trimming on values
    await page.authenticate({
      username: proxyConfig.username,
      password: proxyConfig.password,
    });
    logger.debug("Proxy authentication configured for page", {
      proxy: `${proxyConfig.host}:${proxyConfig.port}`,
    });
    return true;
  } catch (error) {
    logger.warn("Proxy authentication failed, continuing without auth", {
      error: error.message,
      proxy: `${proxyConfig.host}:${proxyConfig.port}`,
      stack: error.stack,
    });
    return false;
  }
};

/**
 * Set up a new page with all default configurations
 * IMPORTANT: Authentication should be done BEFORE calling this function
 * to ensure it happens before any requests are made
 * @param {Page} page - Puppeteer page object
 * @param {Object} proxyConfig - Optional proxy configuration (deprecated - auth should be done before)
 */
const setupPage = async (page, proxyConfig = null) => {
  // Configure page settings
  await configurePage(page);
  // Set up request interception (must be after authentication if auth is needed)
  await setupRequestInterception(page);
  // Note: Authentication is now done in PuppeteerManager before calling setupPage
  // This ensures auth happens before any requests
};

module.exports = {
  configurePage,
  setupRequestInterception,
  authenticateProxy,
  setupPage,
};
