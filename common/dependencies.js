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
    return await puppeteer.launch({
      headless: process.env.NODE_ENV === "development" ? false : true,
      // Handle browser process errors to prevent listener accumulation
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-features=IsolateOrigins,site-per-process",
        // Memory optimizations (safe for bot detection - don't trigger flags)
        "--disable-gpu", // Reduces memory usage
        "--disable-software-rasterizer", // Saves memory
        "--disable-extensions", // Reduces memory footprint
        "--disable-plugins", // Saves memory
        "--disable-sync", // Reduces background processes
        "--disable-background-timer-throttling", // Prevents memory leaks
        "--disable-backgrounding-occluded-windows", // Memory optimization
        "--disable-renderer-backgrounding", // Prevents memory accumulation
        "--disable-blink-features=AutomationControlled", // Hide automation
        "--disable-images", // Disable images to save memory
        "--blink-settings=imagesEnabled=false", // Disable images in Blink engine
        "--disable-component-extensions-with-background-pages", // Reduces extension overhead
        "--disable-ipc-flooding-protection", // Better for automation
        "--metrics-recording-only", // Reduce telemetry overhead
        "--mute-audio", // Disable audio processing
        "--disable-notifications", // Prevent notification pop-ups
        "--disable-default-apps", // Don't load default apps
      ],
    });
  },
  changeisUpdating,
  createDataCollection,
  updateDataCollection,
  getApprovedAssociationsAccounts,
  getClubRelationsForAssociation,
};
