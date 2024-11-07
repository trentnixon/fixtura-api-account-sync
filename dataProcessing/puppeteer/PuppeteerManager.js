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
        headless: process.env.NODE_ENV === "development" ? false : "shell",
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
    for (const disposable of this.disposables) {
      try {
        await disposable.dispose();
      } catch (error) {
        logger.error("Error disposing resource", { error });
      }
    }
    this.disposables = [];
    await this.closeBrowser();
  }
}

module.exports = PuppeteerManager;
