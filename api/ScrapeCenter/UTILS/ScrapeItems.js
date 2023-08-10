const logger = require("../../Utils/logger");

const Find_Item = async (matchElement, SELECTOR) => {
  try {
    const element = await matchElement.$(SELECTOR);
    if (element) {
      const item = await matchElement.$eval(SELECTOR, (el) =>
        el.textContent.trim()
      );
      return item;
    } else {
      // Handle the case when the selector is not found
      logger.error(`Selector "${SELECTOR}" not found.`);
      return false;
    }
  } catch (error) {
    logger.error("Error finding item:", SELECTOR, error);
    logger.critical("An error occurred in Find_Item", {
      file: "ScrapeItems.js",
      function: "Find_Item",
      error: error,
    });
    return false;
  }
};

  async function ScrapeRound(matchElement, SELECTOR) {
    return await Find_Item(matchElement, SELECTOR);
  }
  const ScrapeDate = async (matchElement, SELECTOR) => {
    return await Find_Item(matchElement, SELECTOR);
  };

  const ScrapeGameURL = async (matchElement, SELECTOR) => {
    try {
      const urlElement = await matchElement.$(SELECTOR);
  
      if (urlElement) {
        const url = await urlElement.evaluate((el) => el.getAttribute("href"));
        return url;
      } else {
        logger.error(`No element found for selector ${SELECTOR}`);
        return null; // or any other default value
      }
    } catch (error) {
      logger.error(`Error scraping game URL with selector ${SELECTOR}`);
      logger.error(error);
      logger.critical("An error occurred in ScrapeTeams", {
        file: "ScrapeItems.js",
        function: "ScrapeTeams",
        error: error,
      });
      return null; // or any other default value
    }
  };

  const ScrapeTeams = async (matchElement, SELECTOR) => {
    try {
      const teams = await matchElement.$$eval(SELECTOR, (anchors) => {
        return anchors.map((a) => {
          const name = a.textContent.trim();
          const url = a.getAttribute("href");
          const id = url.split("/").pop();
          return { name, id };
        });
      });
      return teams;
    } catch (error) {
      logger.error("Error scraping teams:", error);
      logger.critical("An error occurred in ScrapeTeams", {
        file: "ScrapeItems.js",
        function: "ScrapeTeams",
        error: error,
      });
      return [];
    }
  };

 
  
  const ScrapeStatus = async (matchElement, SELECTORS) => {
    const statusFinalSelector = await Find_Item(matchElement, SELECTORS.STATUS);
    return statusFinalSelector;
  };

  const ScrapeTime = async (matchElement, SELECTOR) => {
    const timeSelector = await Find_Item(matchElement, SELECTOR);
    return timeSelector;
  };
  
  const ScrapeType = async (matchElement, SELECTOR) => {
    console.log("ScrapeType ", SELECTOR)
    const typeRegular = await Find_Item(matchElement, SELECTOR);
    console.log("typeRegular", typeRegular);
    return typeRegular;
  };
  
  const ScrapeGround = async (matchElement, SELECTOR) => {
    const groundSelector = await Find_Item(matchElement, SELECTOR);
    return groundSelector;
  };

  async function scrapeTypeTimeGround(matchElement, selectors) {
    const parentDivSelector = "li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2)";
    const parentDiv = await matchElement.$(parentDivSelector);
    const childElements = await parentDiv.$$(':scope > *');
    
    // Determine the offset based on the number of child elements
    const offset = childElements.length === 4 ? 1 : 0;
  
    // Adjust the selectors based on the offset

    const typeSelector = `li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(${1+offset})`;
    const timeSelector = `li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(${2+offset}) > div:nth-child(2) > span`;
    const groundSelector = `li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(${3+offset}) span`;
  
    // Scrape the data using the adjusted selectors
    const type = await ScrapeType(matchElement, typeSelector);
    const time = await ScrapeTime(matchElement, timeSelector);
    const ground = await ScrapeGround(matchElement, groundSelector);
  
    console.log('type',type)
    console.log('time', time)
    console.log('ground', ground)
    // Return the scraped data
    return { type, time, ground };
  }
  

module.exports = {
  ScrapeRound,
  ScrapeDate,
  ScrapeGameURL,
  ScrapeTeams,
  ScrapeTime,
  ScrapeType,
  ScrapeGround,
  ScrapeStatus,
  scrapeTypeTimeGround
};