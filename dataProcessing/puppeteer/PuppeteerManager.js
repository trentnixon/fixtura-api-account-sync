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
        headless: process.env.NODE_ENV === 'development' ? false : 'new',
        //headless: false, // Consider setting to true for production
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
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

    // Create a new incognito browser context
    const context = await this.browser.createIncognitoBrowserContext();
    // Create a new page within this context
    const page = await context.newPage();

    // Add context to disposables for cleanup
    this.addDisposable(context);

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
