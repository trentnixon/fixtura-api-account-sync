const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("../../src/utils/logger");
puppeteer.use(StealthPlugin());

class PuppeteerManager {
  constructor() {
    this.browser = null;
    this.disposables = [];
  }

  async launchBrowser() {
    if (this.browser) {
      // Browser is already launched, so just return.
      return;
    }
    try {
      this.browser = await puppeteer.launch({
        headless:
          process.env.NODE_ENV && process.env.NODE_ENV.trim() === "development"
            ? false
            : true,
        //headless: 'new', // Consider setting to true for production
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      });
      logger.info("Puppeteer browser launched");
    } catch (error) {
      logger.error("Error launching Puppeteer browser", { error });
      throw error;
    }
  }

  async createPageInNewContext() {
    await this.launchBrowser();
    const page = await this.browser.newPage();

    // Note: Request interception should be set by individual services
    // if needed, to avoid conflicts with multiple handlers

    this.addDisposable(page);
    return page;
  }

  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null; // Ensure the reference is cleared
        logger.info("Puppeteer browser closed");
      }
    } catch (error) {
      logger.error("Error closing Puppeteer browser", { error });
    }
  }

  addDisposable(disposable) {
    if (disposable && typeof disposable.dispose === "function") {
      this.disposables.push(disposable);
    }
  }

  async dispose() {
    // Close all pages first to free memory
    try {
      const pages = await this.browser?.pages();
      if (pages && pages.length > 0) {
        await Promise.all(
          pages.map(async (page) => {
            try {
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (pageError) {
              logger.warn(`Error closing page: ${pageError.message}`);
            }
          })
        );
      }
    } catch (pagesError) {
      logger.warn(`Error getting pages: ${pagesError.message}`);
    }

    // Dispose of registered disposables
    for (const disposable of this.disposables) {
      try {
        if (disposable && typeof disposable.dispose === "function") {
          await disposable.dispose();
        } else if (disposable && typeof disposable.close === "function") {
          // If it's a page, close it
          await disposable.close();
        }
      } catch (error) {
        logger.warn("Error disposing resource", { error: error.message });
      }
    }
    this.disposables = [];

    // Close browser
    await this.closeBrowser();

    // Force garbage collection hint (if available)
    if (global.gc) {
      global.gc();
    }
  }
}

module.exports = PuppeteerManager;
