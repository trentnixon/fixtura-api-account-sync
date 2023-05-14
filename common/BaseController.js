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

  async dispose() {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === "function") {
        disposable.dispose();
      }
    }

    this.disposables = [];

    if (this.browser) {
      await this.browser.close();
      console.log("CLOSE BROWSER IN BASECONTROLLER")
    }
  }
}

module.exports = BaseController;

