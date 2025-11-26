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

    // CRITICAL: Set user agent and viewport to avoid CAPTCHA detection
    // Puppeteer v24 uses Chrome 131.x - use matching user agent
    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      );
    } catch (uaError) {
      logger.warn("Failed to set user agent", { error: uaError.message });
    }

    // Set viewport to avoid detection (common desktop resolution)
    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });
    } catch (viewportError) {
      logger.warn("Failed to set viewport", { error: viewportError.message });
    }

    // Add additional evasions to avoid detection
    try {
      // Override webdriver property
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });
      });

      // Override plugins to look like a real browser
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      // Override languages
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });
      });
    } catch (evasionError) {
      logger.warn("Failed to set page evasions", {
        error: evasionError.message,
      });
    }

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
