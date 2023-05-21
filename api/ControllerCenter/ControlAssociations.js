const AssociationDetailsController = require("../Puppeteer/AssociationDetails/AssociationDetailsController");
// DataCenter
const { DataCenterClubs } = require("../DataCenter/evaluateClubs");
const GetCompetitions = require("../ScrapeCenter/getCompetitions");

/*
    This is the Control Center for Associations data conditioning, scraping and Assigning
    Here we will condition the data to and from strapi, evalute the data used for pupeteer.

    we will also manage the pupeteer classes to ensure items are used only once

*/

/* const StartScrapeGetCompetitions = async (DATAOBJ, FromSTRAPI)=>{
    const getCompetitionsObj = new GetCompetitions(
        DATAOBJ.CLUBOBJ.ClubURL,
        FromSTRAPI.ID
      );
      const ScrapedCompetitions = await getCompetitionsObj.setup();
      
      return ScrapedCompetitions
} */


async function Controller_Associations(FromSTRAPI) {
    try {
      //const intervalId = trackMemoryUsage();
      
      //Step 1 -  Get the conditioned Data
    /*   const DATAOBJ = await DataCenterClubs(FromSTRAPI);
      console.log(DATAOBJ);
      const CompetitionsFoundOnPlayHQ = StartScrapeGetCompetitions(DATAOBJ, FromSTRAPI)
      console.log(CompetitionsFoundOnPlayHQ); */
      /* 
      const clubController = new ClubDetailsController();
      const result = await clubController.setup(id); // Call the Setup method directly
     */
      //clearInterval(intervalId);
      return result;
    } catch (error) {
      //clearInterval(intervalId);
      console.error(`Error getting Club Details: ${error}`);
      throw error;
    }
  }

  module.exports = { Controller_Associations };

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
