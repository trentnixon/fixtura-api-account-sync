/**
 * Browser Launch Configuration
 * Centralized Puppeteer browser launch arguments and options
 */

/**
 * Get base launch arguments for Puppeteer
 * These are the common arguments used by both modern and legacy launchers
 * @returns {string[]} Array of launch arguments
 */
const getBaseLaunchArgs = () => {
  return [
    "--disable-setuid-sandbox",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-sync",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-blink-features=AutomationControlled",
    "--disable-component-extensions-with-background-pages",
    "--disable-ipc-flooding-protection",
    "--mute-audio",
    "--disable-notifications",
    "--disable-default-apps",
    // PROXY OPTIMIZATION: Reduce overhead and improve connection reuse
    "--aggressive-cache-discard", // Reduce cache overhead through proxy
    "--disable-application-cache", // Disable app cache for faster proxy connections
    "--disable-background-downloads", // Reduce background network activity
    "--disable-client-side-phishing-detection", // Reduce proxy overhead
    "--disable-hang-monitor", // Reduce monitoring overhead
    "--disable-popup-blocking", // Already handled, but explicit
    "--disable-prompt-on-repost", // Reduce proxy round-trips
    "--disable-translate", // Reduce network calls
    "--disable-web-security", // Only if needed for scraping (reduces proxy overhead)
    "--enable-features=NetworkService,NetworkServiceLogging", // Better connection management
  ];
};

/**
 * Get launch arguments for legacy browser launcher
 * Legacy launcher uses more aggressive memory optimizations
 * @returns {string[]} Array of launch arguments
 */
const getLegacyLaunchArgs = () => {
  return [
    ...getBaseLaunchArgs(),
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-images",
    "--blink-settings=imagesEnabled=false",
    "--metrics-recording-only",
  ];
};

/**
 * Get launch options for modern PuppeteerManager
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode
 * @param {string|null} options.proxyServer - Proxy server URL (optional)
 * @param {number} options.protocolTimeout - Protocol timeout in ms
 * @returns {Object} Puppeteer launch options
 */
const getLaunchOptions = (options = {}) => {
  const {
    headless = true,
    proxyServer = null,
    protocolTimeout = 90000, // PROXY OPTIMIZATION: Default reduced from 120s to 90s
  } = options;

  const args = getBaseLaunchArgs();

  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
    // PROXY OPTIMIZATION: Add proxy-specific optimizations
    args.push("--enable-features=NetworkService"); // Better proxy connection management
  }

  return {
    headless,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    protocolTimeout,
    args,
  };
};

/**
 * Get launch options for legacy browser launcher
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode
 * @param {string|null} options.proxyServer - Proxy server URL (optional)
 * @returns {Object} Puppeteer launch options
 */
const getLegacyLaunchOptions = (options = {}) => {
  const { headless = true, proxyServer = null } = options;

  const args = getLegacyLaunchArgs();

  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
  }

  return {
    headless,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    args,
  };
};

module.exports = {
  getBaseLaunchArgs,
  getLegacyLaunchArgs,
  getLaunchOptions,
  getLegacyLaunchOptions,
};
