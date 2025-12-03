/**
 * SOLID APPROVED
 * DO NOT ADJUST UNLESS ERROR IN CODE
 */
// BaseController.js
class BaseController {
  constructor() {
    this.browser = null;
    this.disposables = [];
    this.dependencies = require("./dependencies");
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async initDependencies(accountId) {
    this.browser = await this.dependencies.getPuppeteerInstance();
    await this.dependencies.changeisUpdating(accountId, true);
  }

  async initCreateDataCollection(accountId) {
    return await this.dependencies.createDataCollection(accountId, true);
  }
  async initUpdateDataCollection(accountId, DATA) {
    await this.dependencies.updateDataCollection(accountId, DATA);
  }

  //

  async dispose() {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === "function") {
        disposable.dispose();
      }
    }

    this.disposables = [];

    // DO NOT close browser here - it's shared via PuppeteerManager singleton
    // Closing it would break other code using the same browser instance
    // Browser cleanup is handled by PuppeteerManager
    this.browser = null;
  }
}

module.exports = BaseController;
