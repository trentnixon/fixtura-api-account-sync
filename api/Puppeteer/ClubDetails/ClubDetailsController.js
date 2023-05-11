/** 
 * SOLID APPROVED  
 * DO NOT ADJUST UNLESS ERROR IN CODE
*/

const BaseController = require("../../../common/BaseController");
const GetClubDetails = require("./GetClubDetails");
const fetcher = require("../../Utils/fetcher");

class ClubDetailsController extends BaseController {
  async setup(accountId) {
    this.browser = await this.dependencies.getPuppeteerInstance();
    return await super.setup(accountId);
  }

  async run(accountId) {
    const clubDetails = new GetClubDetails(fetcher, this.browser);
    const result = await clubDetails.Setup(accountId);
    this.disposables.push(clubDetails);
    return result;
  }
}

module.exports = ClubDetailsController;
