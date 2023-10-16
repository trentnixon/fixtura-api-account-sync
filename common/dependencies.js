const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fetcher = require("../api/Utils/fetcher");

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
  console.log("createDataCollection ID", ID);
  const currentDate = new Date();
  const DATACOLLECTIONID = await fetcher(`data-collections`, `POST`, {
    data: {
      account: [ID],
      whenWasTheLastCollection: currentDate,
    },
  });
  /*   console.log("DATACOLLECTIONID")
  console.log(DATACOLLECTIONID.id) */
  return DATACOLLECTIONID.id;
};

const updateDataCollection = async (ID, OBJ) => {
  console.log("updateDataCollection", ID);
  console.log(ID, OBJ);
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
      headless: 'new',
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
    });
  },
  changeisUpdating,
  createDataCollection,
  updateDataCollection,
  getApprovedAssociationsAccounts,
  getClubRelationsForAssociation,
};