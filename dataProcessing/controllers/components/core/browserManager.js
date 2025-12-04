const logger = require("../../../../src/utils/logger");
const PuppeteerManager = require("../../../puppeteer/PuppeteerManager");

/**
 * Browser management utilities for memory optimization
 */
class BrowserManager {
  /**
   * Force browser restart between processing stages to prevent memory accumulation
   * This helps prevent memory spikes in single-job executions
   */
  static async forceBrowserRestartIfNeeded() {
    try {
      const puppeteerManager = PuppeteerManager.getInstance();
      if (puppeteerManager && puppeteerManager.browser) {
        logger.info(
          "[MEMORY] Forcing browser restart between processing stages"
        );
        await puppeteerManager.forceRestartBrowser();
        logger.info("[MEMORY] Browser restart completed between stages");
      }
    } catch (error) {
      logger.warn("[MEMORY] Error forcing browser restart between stages", {
        error: error.message,
      });
      // Don't throw - browser restart is optional optimization
    }
  }
}

module.exports = BrowserManager;

