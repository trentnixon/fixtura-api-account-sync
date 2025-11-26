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

    // CRITICAL: Configure page with comprehensive anti-detection measures
    await this.configurePageForStealth(page);

    // Add page to disposables for cleanup
    this.addDisposable(page);

    return page;
  }

  /**
   * Configures a page with comprehensive stealth and anti-CAPTCHA measures
   * This method applies all evasions needed to bypass detection on Heroku
   */
  async configurePageForStealth(page) {
    try {
      // Set user agent - Puppeteer v24 uses Chrome 131.x
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

    // Set realistic HTTP headers
    try {
      await page.setExtraHTTPHeaders({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      });
    } catch (headersError) {
      logger.warn("Failed to set HTTP headers", {
        error: headersError.message,
      });
    }

    // Comprehensive evasions - all in one evaluateOnNewDocument for efficiency
    try {
      await page.evaluateOnNewDocument(() => {
        // Override chrome property (critical for detection)
        window.chrome = {
          runtime: {},
          loadTimes: function () {},
          csi: function () {},
          app: {},
        };

        // Override webdriver property
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });

        // Remove webdriver from navigator prototype
        delete window.navigator.__proto__.webdriver;

        // Override plugins to look like a real browser
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });

        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);

        // Override iframe contentWindow
        Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
          get: function () {
            return window;
          },
        });

        // Override toString methods to hide automation
        const getParameter = WebGLRenderingContext.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) {
            return "Intel Inc.";
          }
          if (parameter === 37446) {
            return "Intel Iris OpenGL Engine";
          }
          return getParameter.call(this, parameter);
        };

        // Override canvas fingerprinting
        const toBlob = HTMLCanvasElement.prototype.toBlob;
        const toDataURL = HTMLCanvasElement.prototype.toDataURL;
        const getImageData = CanvasRenderingContext2D.prototype.getImageData;

        // Add noise to canvas operations
        HTMLCanvasElement.prototype.toBlob = function (
          callback,
          type,
          quality
        ) {
          const canvas = this;
          return toBlob.call(canvas, callback, type, quality);
        };

        // Override notification permission
        if (Notification.permission === "default") {
          Object.defineProperty(Notification, "permission", {
            get: () => "default",
          });
        }
      });
    } catch (evasionError) {
      logger.warn("Failed to set page evasions", {
        error: evasionError.message,
      });
    }
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
