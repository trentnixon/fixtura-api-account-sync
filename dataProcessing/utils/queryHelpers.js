const qs = require("qs");

const queryHelpers = {
  getClubRelationsForClub: (clubId) => {
    return qs.stringify({
      populate: ["teams", "competitions", "associations"], // Update with actual relations needed
    }, { encodeValuesOnly: true });
  },

  getClubRelationsForAssociation: (associationId) => {
    return qs.stringify({
      populate: ["clubs", "competitions"], // Update with actual relations needed
    }, { encodeValuesOnly: true });
  },

  // Additional query helper methods...
};

module.exports = queryHelpers;
