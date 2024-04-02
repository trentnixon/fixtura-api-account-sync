const qs = require("qs");

const queryHelpers = {
  getClubRelationsForClub: () => {
    return qs.stringify(
      {
        populate: [
          "teams",
          "competitions",
          "associations",
          "associations.competitions",
          "club_to_competitions",
        ], // Update with actual relations needed
      },
      { encodeValuesOnly: true }
    );
  },

  getClubRelationsForAssociation: (associationId) => {
    return qs.stringify(
      {
        populate: ["clubs", "competitions"], // Update with actual relations needed
      },
      { encodeValuesOnly: true }
    );
  },

  // Additional query helper methods...
};

module.exports = queryHelpers;
