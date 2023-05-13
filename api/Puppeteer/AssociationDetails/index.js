const fetcher = require("../../Utils/fetcher");
// has Pupeteer
const getCompetitions = require("./getCompetitions");
const getClubDetails = require("./ClubDetails");
const getNoClubDetails = require("../NoClubAssociations/NoClubsInAssociationDetails");
// is assign
const assignCompetitionsToAssociation = require("./assignCompetitionsToAssociation");
const logger = require("../../Utils/logger");

const qs = require("qs");

class getAssociationDetails {
  constructor(browser) {
    this.browser = null;
    this.disposables = [];
  }
 
  setBrowser(browser) {
    this.browser = browser;  
  }
  
  async Setup(ACCOUNTID) {
    logger.debug(`Update Accont ${ACCOUNTID}`);

    /* **************************************************************************** */
    // Step 1: Collect approved and active Associtaions accounts from the DB
    /* **************************************************************************** */
    const Account = await fetcher(
      `accounts/${ACCOUNTID}?${getApprovedAssociationsAccounts()}`
    );
    // Let the DB know this Account it updating
    //await changeisUpdating(ACCOUNTID, true);
    const ASSOCIATIONID = Account.attributes.associations.data[0].id;

    try {
      /* **************************************************************************** */
      // Step 2: Check the club's competition page and update any old ones
      /* **************************************************************************** */

      const getCompetitionsObj = new getCompetitions(Account); 
      getCompetitionsObj.setBrowser(this.browser);
      const competitions = await getCompetitionsObj.Setup();
      this.disposables.push(getCompetitionsObj);
      // if no results then exit out of class
      if (!competitions) {
        logger.debug(`No competitions found for club ${ASSOCIATIONID}`);
        // create new data colletion ID
        // Let the DB know this Account it updating
        //await changeisUpdating(ACCOUNTID, false);
        //await createDataCollection(ACCOUNTID, { error: false });
        // return false back to the paent
        return false;
      }
      /* **************************************************************************** */
      // Step 3: assign competitions to Association
      /* **************************************************************************** */

      // this needs to be written for assoc
      const uploader = new assignCompetitionsToAssociation();
      const result = await uploader.Setup(competitions, ASSOCIATIONID);
      logger.debug(`Assigned competitions to club: ${result.success}`);

      /* **************************************************************************** */
      // Step 4 // Refetch the Associtaions on its ID
      /* **************************************************************************** */

      const ActiveAssociation = await fetcher(
        `associations/${ASSOCIATIONID}?${getClubRelations()}`
      );

      // CLEAN UP ALL OF THIS!!!/
      // The MAIN ASSOCIATION CLASS NEEDS THE LADDER SCRAP
      // Find association databy looping through the clubs assigned to the association and grabbing there data via the club updater
      const ASSOCIATIONCLUBS = ActiveAssociation.attributes.clubs.data;
      logger.info("ASSOCIATIONCLUBS ", ASSOCIATIONCLUBS.length);
      console.log(ASSOCIATIONCLUBS.length )
      if (ASSOCIATIONCLUBS.length > 0) {
        logger.info("Process Association with Clubs");
        // if the association is a normal one, then run the checker
        for (let i = 0; i < ASSOCIATIONCLUBS.length; i++) {
          const CLUBID = ASSOCIATIONCLUBS[i].id;
          const CLUBURL = ASSOCIATIONCLUBS[i].attributes.href;

          const getClubDetailsObj = new getClubDetails();
          getClubDetailsObj.setBrowser(this.browser);
          await getClubDetailsObj.Setup(CLUBID, CLUBURL);
          // Add the ClubDetails instance to the disposables array
          this.disposables.push(getClubDetailsObj);
        }
      } else {
        logger.info("Process Association with NO Clubs");
        // if the association is like sydneyjuniors then run here
        const ASSOCIATIONCOMPS = ActiveAssociation.attributes.competitions.data;
       
        for (let i = 0; i < ASSOCIATIONCOMPS.length; i++) {
          const COMPETITION = ASSOCIATIONCOMPS[i];
          const NoClubDetails = new getNoClubDetails(); 
          NoClubDetails.setBrowser(this.browser);
          await NoClubDetails.Setup(COMPETITION);

          // Add the NoClubDetails instance to the disposables array
          this.disposables.push(NoClubDetails);
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error processing Association ${Account.id}:`, error);
    } finally {
    }

    /* **************************************************************************** */
    // Step 8 // let the DB know that a data collection happened
    /* **************************************************************************** */
    // Let the DB know this Account it updating
    //await changeisUpdating(ACCOUNTID, false);
    //await createDataCollection(ACCOUNTID, { error: false });

    return { complete: true };
  }

  // Update the dispose method to clean up the disposables array
  dispose() {
    // Dispose of all instances in the disposables array
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === "function") {
        disposable.dispose();
      }
    }

    // Clear the disposables array
    this.disposables = [];
  }
}

module.exports = getAssociationDetails;
/* 
const createDataCollection = async (ID, ERR) => {
  //data-collections
  const currentDate = new Date();
  await fetcher(`data-collections`, `POST`, {
    data: {
      account: [ID],
      whenWasTheLastCollection: currentDate,
    },
  });
  return true;
}; */

const changeisUpdating = async (ID, isUpdating) => {
  //data-collections
  const currentDate = new Date();
  await fetcher(`accounts/${ID}`, `PUT`, {
    data: {
      isUpdating: isUpdating,
    },
  });
  return true;
};

const getApprovedAssociationsAccounts = () => {
  return qs.stringify(
    {
      populate: ["associations", "account_type", "associations.clubs"],
    },
    {
      encodeValuesOnly: true,
    }
  );
};

const getClubRelations = () => {
  return qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },

      populate: [
        "href",
        "competitions",
        "clubs.club_to_competitions",
        "competitions",
        "competitions.grades",
        "competitions.club_to_competitions",
        "competitions.teams",
      ],
    },
    {
      encodeValuesOnly: true,
    }
  );
};
