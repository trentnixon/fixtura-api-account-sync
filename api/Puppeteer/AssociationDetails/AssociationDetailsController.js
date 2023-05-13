// AssociationDetailsController.js
const BaseController = require("../../../common/BaseController");
const getCompetitions = require("./getCompetitions");
const assignCompetitionsToAssociation = require("./assignCompetitionsToAssociation");
const GetClubDetails = require("./ClubDetails");
const GetNoClubDetails = require("../NoClubAssociations/NoClubsInAssociationDetails");

const logger = require("../../Utils/logger");
const fetcher = require("../../Utils/fetcher");

class AssociationDetailsController extends BaseController {
  constructor() {
    super();
    this.dependencies = require("../../../common/dependencies");
  } 

  async processAssociation(accountId) {
    const Account = await fetcher(
      `accounts/${accountId}?${this.dependencies.getApprovedAssociationsAccounts()}`
    );
    const associationId = Account.attributes.associations.data[0].id;

    try {
      let getCompetitionsObj = new getCompetitions(Account);
      getCompetitionsObj.setBrowser(this.browser);
      const competitions = await getCompetitionsObj.setup();
      getCompetitionsObj = null
      this.disposables.push(getCompetitionsObj);

      if (!competitions) {
        logger.debug(`No competitions found for club ${associationId}`);
        return false;
      }

        console.log(competitions)
  /*     const uploader = new assignCompetitionsToAssociation();
      const result = await uploader.Setup(competitions, associationId);
      logger.debug(`Assigned competitions to club: ${result.success}`);

      const ActiveAssociation = await fetcher(
        `associations/${associationId}?${this.dependencies.getClubRelationsForAssociation()}`
      );

      const associationClubs = ActiveAssociation.attributes.clubs.data;

      if (associationClubs.length > 0) {
        logger.info("Process Association with Clubs");

        for (const club of associationClubs) {
          const clubId = club.id;
          const clubUrl = club.attributes.href;

          const getClubDetailsObj = new GetClubDetails();
          getClubDetailsObj.setBrowser(this.browser);
          await getClubDetailsObj.setup(clubId, clubUrl);
          this.disposables.push(getClubDetailsObj);
        }
      } else {
        logger.info("Process Association with NO Clubs");
        const associationComps = ActiveAssociation.attributes.competitions.data;

        for (const competition of associationComps) {
          const noClubDetailsObj = new GetNoClubDetails();
          noClubDetailsObj.setBrowser(this.browser);
          await noClubDetailsObj.setup(competition);
          this.disposables.push(noClubDetailsObj);
        }
      } */

      return true;
    } catch (error) {
      logger.error(`Error processing Association ${Account.id}:`, error);
    } finally {
      await this.dispose(); // Dispose resources after processing
    }

    return { complete: true };
  }

  async setup(accountId) {
    await this.initDependencies(accountId);
    const result = await this.processAssociation(accountId);
    await this.dependencies.changeisUpdating(accountId, false);
    await this.dependencies.createDataCollection(accountId, { error: false });

    return result;
  }


}

module.exports = AssociationDetailsController;

