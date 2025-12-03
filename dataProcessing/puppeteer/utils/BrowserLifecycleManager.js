/**
 * BrowserLifecycleManager - Handles browser lifecycle (launch, restart, close)
 * Extracted from PuppeteerManager for better separation of concerns
 */

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../../src/utils/logger");
const { getLaunchOptions } = require("../browserConfig");
const { BROWSER_CONFIG, isDevelopment } = require("../constants");
const { getMemoryStats } = require("../memoryUtils");
const { closePagesSafely, getPagesSafely } = require("../pageUtils");

puppeteer.use(StealthPlugin());

class BrowserLifecycleManager {
  constructor(circuitBreaker, proxyConfigManager) {
    this.browser = null;
    this.circuitBreaker = circuitBreaker;
    this.proxyConfigManager = proxyConfigManager;
  }

  /**
   * Launch browser with proxy support and circuit breaker protection
   * @returns {Promise<void>}
   */
  async launch() {
    logger.info(
      `[BrowserLifecycleManager] Called - browser exists: ${!!this.browser}`
    );

    // Check if browser already exists
    if (this.browser) {
      logger.debug("[BrowserLifecycleManager] Browser already exists, returning");
      return;
    }

    // Execute browser launch through circuit breaker
    try {
      await this.circuitBreaker.execute(async () => {
        await this._launchInternal();
      });
    } catch (error) {
      // If circuit breaker is OPEN, log and re-throw
      if (error.message && error.message.includes("Circuit breaker is OPEN")) {
        logger.error(
          "[BrowserLifecycleManager] Circuit breaker is OPEN - proxy appears to be down",
          {
            circuitState: this.circuitBreaker.getState(),
            error: error.message,
          }
        );
        throw error;
      }
      // Other errors are re-thrown as-is
      throw error;
    }
  }

  /**
   * Internal browser launch logic (wrapped by circuit breaker)
   * @private
   */
  async _launchInternal() {
    logger.info("[BrowserLifecycleManager] Launching browser...");

    try {
      // Rotate proxy port if enabled (before launching new browser)
      this.proxyConfigManager.rotatePort();

      // Get proxy configuration
      const proxyConfig = this.proxyConfigManager.getConfig();
      const { getLaunchOptions } = require("../browserConfig");

      try {
        const launchOptions = getLaunchOptions({
          headless: !isDevelopment(),
          proxyServer: proxyConfig ? proxyConfig.server : null,
          protocolTimeout: BROWSER_CONFIG.PROTOCOL_TIMEOUT,
        });

        if (proxyConfig) {
          logger.info("Puppeteer browser launching with Decodo proxy", {
            proxy: `${proxyConfig.host}:${proxyConfig.port}`,
            portRotation: proxyConfig.hasMultiplePorts
              ? `${proxyConfig.totalPorts} ports available`
              : "single port",
          });
        }

        this.browser = await puppeteer.launch(launchOptions);

        // Authenticate browser with proxy credentials if needed
        // EXACTLY like dependencies.js (production code)
        if (
          proxyConfig &&
          proxyConfig.username &&
          proxyConfig.password &&
          proxyConfig.username.trim() !== "" &&
          proxyConfig.password.trim() !== ""
        ) {
          try {
            // Authenticate the default page immediately after launch
            // EXACTLY like dependencies.js - no trimming on values
            const pages = await this.browser.pages();
            if (pages.length > 0) {
              await pages[0].authenticate({
                username: proxyConfig.username,
                password: proxyConfig.password,
              });
              logger.info("Proxy authentication configured on default page", {
                proxy: `${proxyConfig.host}:${proxyConfig.port}`,
              });
            }
          } catch (authError) {
            logger.error(
              "Failed to authenticate browser with proxy - this will cause HTTP 407 errors",
              {
                error: authError.message,
                proxy: `${proxyConfig.host}:${proxyConfig.port}`,
                stack: authError.stack,
              }
            );
            // Don't throw - allow browser to continue, but this will likely cause 407 errors
          }
        } else if (proxyConfig) {
          logger.warn("Proxy configured but credentials missing or empty", {
            hasUsername: !!proxyConfig.username,
            hasPassword: !!proxyConfig.password,
            proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          });
        }

        logger.info("Puppeteer browser launched", {
          proxyEnabled: proxyConfig !== null,
        });
      } catch (error) {
        logger.error("[BrowserLifecycleManager] Error launching Puppeteer browser", {
          error,
        });

        // If proxy was enabled and launch failed, try without proxy as fallback
        if (proxyConfig) {
          logger.warn(
            "Browser launch with proxy failed, retrying without proxy",
            { error: error.message }
          );
          try {
            const fallbackOptions = getLaunchOptions({
              headless: !isDevelopment(),
              proxyServer: null,
              protocolTimeout: BROWSER_CONFIG.PROTOCOL_TIMEOUT,
            });

            this.browser = await puppeteer.launch(fallbackOptions);
            logger.warn("Browser launched without proxy (fallback mode)");
          } catch (fallbackError) {
            logger.error("Browser launch failed even without proxy", {
              error: fallbackError,
            });
            throw fallbackError;
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error("[BrowserLifecycleManager] Outer error launching browser", {
        error,
      });
      throw error;
    }
  }

  /**
   * Restart browser to free memory
   * @param {Set} activePages - Set of active pages (won't restart if pages are active)
   * @param {Function} cleanupPagesCallback - Callback to cleanup pages before restart
   * @param {Function} resetCountersCallback - Callback to reset operation counters after restart
   * @returns {Promise<void>}
   */
  async restart(activePages, cleanupPagesCallback, resetCountersCallback) {
    // Don't restart if pages are actively being used
    if (activePages.size > 0) {
      logger.info(
        `[BrowserLifecycleManager] Deferring browser restart - ${activePages.size} active page(s) in use`
      );
      return;
    }

    try {
      const statsBefore = getMemoryStats();
      logger.info(
        `[BrowserLifecycleManager] Restarting browser to free memory (RSS before: ${statsBefore.rss.toFixed(
          2
        )}MB)...`
      );

      // Cleanup pages before restart
      if (cleanupPagesCallback) {
        await cleanupPagesCallback();
      }

      // Close browser
      await this.close();

      // Reset counters
      if (resetCountersCallback) {
        resetCountersCallback();
      }

      // Delay to let memory free up
      await new Promise((resolve) =>
        setTimeout(resolve, BROWSER_CONFIG.RESTART_DELAY)
      );

      // Launch new browser
      await this.launch();

      const statsAfter = getMemoryStats();
      const freedMB = statsBefore.rss - statsAfter.rss;
      logger.info(
        `[BrowserLifecycleManager] Browser restarted successfully (RSS after: ${statsAfter.rss.toFixed(
          2
        )}MB, freed: ${freedMB.toFixed(2)}MB)`
      );
    } catch (error) {
      logger.error("[BrowserLifecycleManager] Error restarting browser", {
        error: error.message,
      });
      // Try to launch a fresh browser anyway
      this.browser = null;
      await this.launch();
    }
  }

  /**
   * Close browser and all pages
   * @param {Function} cleanupPagesCallback - Optional callback to cleanup page references
   * @returns {Promise<void>}
   */
  async close(cleanupPagesCallback) {
    if (!this.browser) return;

    try {
      const pages = await getPagesSafely(this.browser);
      if (pages.length > 0) {
        await closePagesSafely(pages);
        // Cleanup page references if callback provided
        if (cleanupPagesCallback) {
          cleanupPagesCallback(pages);
        }
      }

      await this.browser.close();
      this.browser = null;
      logger.info("[BrowserLifecycleManager] Puppeteer browser closed");
    } catch (error) {
      logger.error("[BrowserLifecycleManager] Error closing Puppeteer browser", {
        error,
      });
      this.browser = null;
    }
  }

  /**
   * Get browser instance
   * @returns {Browser|null}
   */
  getBrowser() {
    return this.browser;
  }

  /**
   * Check if browser exists
   * @returns {boolean}
   */
  exists() {
    return !!this.browser;
  }
}

module.exports = BrowserLifecycleManager;

