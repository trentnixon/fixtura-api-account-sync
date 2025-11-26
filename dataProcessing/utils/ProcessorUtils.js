const qs = require("qs");
const fetcher = require("../../src/utils/fetcher");

/** CLUBS  */
const getClubObj = async (ID) => {
  const query = qs.stringify(
    { populate: ["associations", "account_type", "clubs"] },
    {
      encodeValuesOnly: true,
    }
  );
  const Account = await fetcher(`accounts/${ID}?${query}`);
  const CLUB = Account.attributes.clubs.data[0];
  // should we require any additional information about a club add it in here
  return {
    TYPEID: CLUB.id,
    TYPEURL: CLUB.attributes.href,
  };
};

const getDetailedClubDetails = async (CLUBID) => {
  const query = qs.stringify(
    {
      pagination: {
        page: 1,
        pageSize: 1,
      },

      populate: [
        "href",
        "competitions",
        "teams",
        "teams.grades",
        "teams.game_meta_data",
        "club_to_competitions",
        "club_to_competitions.club",
        "club_to_competitions.competition",
        "club_to_competitions.competition.grades",
        "associations",
        "associations.competitions",
      ],
    },
    {
      encodeValuesOnly: true,
    }
  );
  return await fetcher(`clubs/${CLUBID}?${query}`);
};

/** ASSOCIATIONS  */
const getAssociationObj = async (ID) => {
  const query = qs.stringify(
    {
      populate: ["associations", "account_type", "associations.clubs"],
    },
    {
      encodeValuesOnly: true,
    }
  );
  const Account = await fetcher(`accounts/${ID}?${query}`);
  const associationId = Account.attributes.associations.data[0].id;
  //console.log("Account", Account);
  return {
    TYPEID: associationId,
    TYPEURL: Account.attributes.associations.data[0].attributes.href,
  };
};

const getDetailedAssociationDetails = async (ASSOCIATIONID) => {
  // Fetch New data
  const query = qs.stringify(
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
        "competitions.club_to_competitions.competition",
        "competitions.teams",
        "competitions.teams.grades",
      ],
    },
    {
      encodeValuesOnly: true,
    }
  );
  return await fetcher(`associations/${ASSOCIATIONID}?${query}`);
};

/** DIRECT ORG FETCHING (Bypasses account lookup) */

/**
 * Fetches club data directly using club ID (bypasses account lookup).
 * Used for direct club ID processing.
 *
 * @param {number} clubId - The club ID to fetch directly
 * @returns {Promise<{clubObj: {TYPEID: number, TYPEURL: string}, details: object}>}
 */
const fetchClubDirectData = async (clubId) => {
  try {
    // Fetch detailed club data directly (no account lookup needed)
    const details = await getDetailedClubDetails(clubId);

    // Check if details is null (404 or fetch error)
    if (!details || !details.attributes) {
      throw new Error(
        `Club not found or could not be fetched for club ID ${clubId} (404 or network error)`
      );
    }

    // Extract club object structure
    const clubObj = {
      TYPEID: clubId,
      TYPEURL: details.attributes?.href || "",
    };

    return {
      clubObj,
      details,
    };
  } catch (error) {
    throw new Error(
      `Error fetching club direct data for club ID ${clubId}: ${error.message}`
    );
  }
};

/**
 * Fetches association data directly using association ID (bypasses account lookup).
 * Used for direct association ID processing.
 *
 * @param {number} associationId - The association ID to fetch directly
 * @returns {Promise<{associationObj: {TYPEID: number, TYPEURL: string}, details: object}>}
 */
const fetchAssociationDirectData = async (associationId) => {
  try {
    // Fetch detailed association data directly (no account lookup needed)
    const details = await getDetailedAssociationDetails(associationId);

    // Check if details is null (404 or fetch error)
    if (!details || !details.attributes) {
      throw new Error(
        `Association not found or could not be fetched for association ID ${associationId} (404 or network error)`
      );
    }

    // Extract association object structure
    const associationObj = {
      TYPEID: associationId,
      TYPEURL: details.attributes?.href || "",
    };

    return {
      associationObj,
      details,
    };
  } catch (error) {
    throw new Error(
      `Error fetching association direct data for association ID ${associationId}: ${error.message}`
    );
  }
};

module.exports = {
  getClubObj,
  getDetailedClubDetails,
  getAssociationObj,
  getDetailedAssociationDetails,
  fetchClubDirectData,
  fetchAssociationDirectData,
};
