const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fetcher = require("../api/Utils/fetcher");

// Fix MaxListenersExceededWarning: Increase max listeners for Puppeteer's Commander
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = 20; // Increase from default 10

const qs = require("qs");
const changeisUpdating = async (ID, isUpdating) => {
  await fetcher(`accounts/${ID}`, `PUT`, {
    data: {
      isUpdating: isUpdating,
    },
  });
  return true;
};

const createDataCollection = async (ID, ERR) => {
  //data-collections
  const currentDate = new Date();
  const DATACOLLECTIONID = await fetcher(`data-collections`, `POST`, {
    data: {
      account: [ID],
      whenWasTheLastCollection: currentDate,
    },
  });
  return DATACOLLECTIONID.id;
};

const updateDataCollection = async (ID, OBJ) => {
  await fetcher(`data-collections/${ID}`, `PUT`, {
    data: OBJ,
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

/* const getCompetitionRelations = () => {
  return qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },

      populate: ["association", "teams", "teams.grade", "teams.game_meta_data"],
    },
    {
      encodeValuesOnly: true,
    }
  );
}; */

const getClubRelationsForAssociation = () => {
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

module.exports = {
  getPuppeteerInstance: async () => {
    // Use PuppeteerManager singleton to prevent multiple browser instances
    // This ensures all code shares the same browser instance and saves memory
    const PuppeteerManager = require("../dataProcessing/puppeteer/PuppeteerManager");
    const puppeteerManager = PuppeteerManager.getInstance();
    await puppeteerManager.launchBrowser();
    return puppeteerManager.browser;
  },
  changeisUpdating,
  createDataCollection,
  updateDataCollection,
  getApprovedAssociationsAccounts,
  getClubRelationsForAssociation,
};
