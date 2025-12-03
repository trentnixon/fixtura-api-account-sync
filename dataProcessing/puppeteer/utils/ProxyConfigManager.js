/**
 * ProxyConfigManager - Handles proxy configuration and port rotation
 * Extracted from PuppeteerManager for better separation of concerns
 */

const logger = require("../../../src/utils/logger");

class ProxyConfigManager {
  constructor() {
    this.currentProxyPortIndex = 0;

    // Verify proxy configuration on initialization
    const { PROXY_CONFIG } = require("../../../src/config/environment");
    if (PROXY_CONFIG.enabled && PROXY_CONFIG.ports) {
      const portRange = PROXY_CONFIG.portRange
        ? `${PROXY_CONFIG.portRange.start}-${PROXY_CONFIG.portRange.end}`
        : "unknown";
      logger.info(
        `[ProxyConfigManager] Initialized with ${PROXY_CONFIG.ports.length} proxy ports (range: ${portRange}). First: ${PROXY_CONFIG.ports[0]}, Last: ${PROXY_CONFIG.ports[PROXY_CONFIG.ports.length - 1]}`
      );

      // Warn if ports count doesn't match expected range
      if (PROXY_CONFIG.portRange && PROXY_CONFIG.ports.length !== (PROXY_CONFIG.portRange.end - PROXY_CONFIG.portRange.start + 1)) {
        logger.warn(
          `[ProxyConfigManager] Port count mismatch! Expected ${PROXY_CONFIG.portRange.end - PROXY_CONFIG.portRange.start + 1} ports but got ${PROXY_CONFIG.ports.length}`
        );
      }
    }
  }

  /**
   * Get proxy configuration with port rotation support
   * @returns {Object|null} Proxy config with server, username, password or null if disabled
   */
  getConfig() {
    const { PROXY_CONFIG } = require("../../../src/config/environment");
    const {
      isProxyConfigValid,
      getProxyServerUrl,
    } = require("../../../src/config/proxyConfig");

    if (!isProxyConfigValid(PROXY_CONFIG)) {
      return null; // No proxy configured
    }

    // Select port (rotate if multiple ports available)
    const portIndex = this.currentProxyPortIndex % PROXY_CONFIG.ports.length;
    const selectedPort = PROXY_CONFIG.ports[portIndex];

    // Debug logging to track port selection (can be disabled if too verbose)
    // Log every 10th port selection or if port index > 10 to catch rotation issues
    if (portIndex >= 10 || portIndex % 10 === 0) {
      logger.debug(
        `[ProxyConfigManager] Using port ${selectedPort} (index ${portIndex + 1}/${PROXY_CONFIG.ports.length})`
      );
    }

    // Do NOT include credentials in URL - use page.authenticate() instead
    // Chrome doesn't support credentials in proxy URL for HTTPS
    const proxyServer = getProxyServerUrl(PROXY_CONFIG.host, selectedPort);

    return {
      server: proxyServer,
      host: PROXY_CONFIG.host,
      port: selectedPort,
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password,
      hasMultiplePorts: PROXY_CONFIG.ports.length > 1,
      totalPorts: PROXY_CONFIG.ports.length,
    };
  }

  /**
   * Rotate to next proxy port (called on browser restart if rotation enabled)
   */
  rotatePort() {
    const { PROXY_CONFIG } = require("../../../src/config/environment");

    if (
      PROXY_CONFIG.enabled &&
      PROXY_CONFIG.rotateOnRestart &&
      PROXY_CONFIG.ports.length > 1
    ) {
      // Log current state before rotation for debugging
      const previousIndex = this.currentProxyPortIndex;
      const previousPort = PROXY_CONFIG.ports[previousIndex];

      this.currentProxyPortIndex =
        (this.currentProxyPortIndex + 1) % PROXY_CONFIG.ports.length;
      const currentPort = PROXY_CONFIG.ports[this.currentProxyPortIndex];
      const portRange = PROXY_CONFIG.portRange
        ? ` (range: ${PROXY_CONFIG.portRange.start}-${PROXY_CONFIG.portRange.end})`
        : "";

      // Enhanced logging with verification
      logger.info(
        `[ProxyConfigManager] Proxy port rotated: ${PROXY_CONFIG.host}:${previousPort} → ${currentPort} (index ${previousIndex + 1} → ${this.currentProxyPortIndex + 1} of ${PROXY_CONFIG.ports.length}${portRange})`
      );

      // Verify ports array integrity (debug only - remove in production if too verbose)
      if (PROXY_CONFIG.ports.length !== 100) {
        logger.warn(
          `[ProxyConfigManager] WARNING: Expected 100 ports but found ${PROXY_CONFIG.ports.length}. First port: ${PROXY_CONFIG.ports[0]}, Last port: ${PROXY_CONFIG.ports[PROXY_CONFIG.ports.length - 1]}`
        );
      }
    }
  }

  /**
   * Authenticate a page with proxy credentials
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<void>}
   */
  async authenticatePage(page) {
    const proxyConfig = this.getConfig();
    if (proxyConfig && proxyConfig.username && proxyConfig.password) {
      try {
        await page.authenticate({
          username: proxyConfig.username,
          password: proxyConfig.password,
        });
        logger.debug(
          "[ProxyConfigManager] Proxy authentication configured for page",
          {
            proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          }
        );
      } catch (authError) {
        logger.error(
          "[ProxyConfigManager] Failed to authenticate page with proxy",
          {
            error: authError.message,
            proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          }
        );
        // Don't throw - page might still work
      }
    }
  }
}

module.exports = ProxyConfigManager;
