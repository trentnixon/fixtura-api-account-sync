const ClubDetailsController = require("./api/Puppeteer/ClubDetails/GetClubDetails");
const AssociationDetailsController = require("./api/Puppeteer/AssociationDetails/AssociationDetailsController");


/* CLUB */
async function updateClubDetails(id) {
  try {
    const clubController = new ClubDetailsController();
    const result = await clubController.setup(id); // Call the Setup method directly
    return result;
  } catch (error) {
    console.error(`Error getting Club Details: ${error}`);
    throw error;
  } 
}


/* ASSOCIATION */

async function updateAssociationDetails(id) {
  try {
    const associationController = new AssociationDetailsController();
    const result = await associationController.setup(id);
    console.log("ASSOCIATION SYNC UPDATE COMPLETE");
    return result;
  } catch (error) {
    console.error(`Error getting Association Details: ${error}`);
    throw error;
  }
}

module.exports = { updateClubDetails, updateAssociationDetails };