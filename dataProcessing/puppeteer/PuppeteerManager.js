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
            : "shell",
        //headless: 'new', // Consider setting to true for production
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--single-process",
          "--no-zygote",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-sync",
          "--disable-images", // Disable images to save memory
          "--blink-settings=imagesEnabled=false", // Disable images in Blink engine
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding", // CRITICAL: Prevents throttling React rendering
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      logger.info("Puppeteer browser launched");
    } catch (error) {
      logger.error("Error launching Puppeteer browser", { error });
      throw error;
    }
  }

  async createPageInNewContext() {
    await this.launchBrowser(); // Ensure the browser is launched only once

    // Create a new page in the default browser context
    const page = await this.browser.newPage();

    // Add page to disposables for cleanup
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
