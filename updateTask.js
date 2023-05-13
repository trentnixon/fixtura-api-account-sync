const ClubDetailsController = require("./api/Puppeteer/ClubDetails/GetClubDetails");
const AssociationDetailsController = require("./api/Puppeteer/AssociationDetails/AssociationDetailsController");

/* CLUB */
async function updateClubDetails(id) {
  try {
    const intervalId = trackMemoryUsage();
    const clubController = new ClubDetailsController();
    const result = await clubController.setup(id); // Call the Setup method directly
    clearInterval(intervalId);
    return result;
  } catch (error) {
    clearInterval(intervalId);
    console.error(`Error getting Club Details: ${error}`);
    throw error;
  }
}

/* ASSOCIATION */
async function updateAssociationDetails(id) {
  try {
    const intervalId = trackMemoryUsage();
    const associationController = new AssociationDetailsController();
    const result = await associationController.setup(id);
    clearInterval(intervalId);
    console.log("ASSOCIATION SYNC UPDATE COMPLETE");
    return result;
  } catch (error) {
    clearInterval(intervalId);
    console.error(`Error getting Association Details: ${error}`);
    throw error;
  }
}

module.exports = { updateClubDetails, updateAssociationDetails };

function trackMemoryUsage(interval = 20000) {
  const intervalId = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const memoryUsageInfo = Object.entries(memoryUsage)
      .map(([key, value]) => {
        return `${key}: ${(value / 1024 / 1024).toFixed(2)} MB`;
      })
      .join(", ");

    console.log(`Memory Usage: ${memoryUsageInfo}`);
  }, interval);

  return intervalId;
}
