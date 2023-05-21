const fetcher = require("../Utils/fetcher");
const qs = require("qs");

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
        "associations.competitions"
        
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



  const getDetailedAssociationDetails = async(ASSOCIATIONID)=>{ 
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
          "competitions.teams",
          "competitions.teams.grades",
           
        ],
      },
      {
        encodeValuesOnly: true,
      }
    );
     return await fetcher(
      `associations/${ASSOCIATIONID}?${query}`
    );
  }

module.exports = { getClubObj, getDetailedClubDetails, getAssociationObj, getDetailedAssociationDetails };
