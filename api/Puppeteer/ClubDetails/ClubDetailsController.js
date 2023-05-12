/** 
 * SOLID APPROVED  
 * DO NOT ADJUST UNLESS ERROR IN CODE
*/

const BaseController = require("../../../common/BaseController");
const GetClubDetails = require("./GetClubDetails");
const fetcher = require("../../Utils/fetcher");

class ClubDetailsController extends BaseController {
  async setup() {
    console.log('TEST 0 . ClubDetailsController setup called');
    this.browser = await this.dependencies.getPuppeteerInstance();
    //await super.setup(accountId);
  }

  async setupAndRun(accountId) {
    console.log('TEST 2 . ClubDetailsController run called');
    const clubDetails = new GetClubDetails(fetcher, this.browser);
    const result = await clubDetails.Setup(accountId);
    this.disposables.push(clubDetails);
    return result;
  }
}

module.exports = ClubDetailsController;
