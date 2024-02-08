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
    try {
      //console.log("process.env.NODE_ENV", process.env.NODE_ENV)
      this.browser = await puppeteer.launch({
        headless: process.env.NODE_ENV === "development" ? false : "new",
        //headless:'new',
        args: [
          "--disable-setuid-sandbox", 
          "--no-sandbox",
          "--single-process",
          "--no-zygote",
        ],
      });
      logger.info("Puppeteer browser launched");
    } catch (error) {
      logger.error("Error launching Puppeteer browser", { error });
      throw error;
    }
  }

  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info("Puppeteer browser closed");
      }
    } catch (error) {
      logger.error("Error closing Puppeteer browser", { error });
      throw error;
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
