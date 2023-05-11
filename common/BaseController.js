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

  async setup(accountId) {
    try {
      await this.dependencies.changeisUpdating(accountId, true);
      return await this.run(accountId);
    } finally {
      await this.dependencies.changeisUpdating(accountId, false);
      await this.dependencies.createDataCollection(accountId, { error: false });
    }
  }

  async run(accountId) {
    throw new Error("Method not implemented");
  }

  async dispose() {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === "function") {
        disposable.dispose();
      }
    }

    this.disposables = [];

    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = BaseController;
