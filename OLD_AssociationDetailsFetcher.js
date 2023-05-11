/** 
 * SOLID APPROVED  
 * DO NOT ADJUST UNLESS ERROR IN CODE
*/

// AssociationDetailsFetcher.js
const BaseController = require("./common/BaseController");
const GetCompetitions = require("./api/Puppeteer/AssociationDetails/AssociationDetailsController");

class AssociationDetailsFetcher extends BaseController {
  setBrowser(browser) {
    this.browser = browser;
  }
  async run(id) {
    const associationDetails = new GetCompetitions(this.browser);
    const result = await associationDetails.setup(id);
    associationDetails.dispose(); 
    return result;
  }
}

module.exports = AssociationDetailsFetcher;

