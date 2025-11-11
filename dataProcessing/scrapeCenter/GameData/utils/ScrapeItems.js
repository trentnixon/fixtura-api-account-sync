const logger = require("../../../../src/utils/logger");
//const moment = require("moment");
const moment = require("moment-timezone");

// Scrapes the round information from the match element
async function scrapeRound(matchElement) {
  try {
    const roundXPath = ".//div[@data-testid='fixture-list']/div/h3";
    const elements = await matchElement.$$(`xpath/${roundXPath}`);

    if (elements.length > 0) {
      return await elements[0].evaluate((el) => el.textContent.trim());
    } else {
      logger.warn(`Round element not found using XPath: ${roundXPath}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error in scrapeRound: ${error.message}`);
    return null;
  }
}

// Scrapes the date information from the match element
async function scrapeDate(matchElement) {
  try {
    const dateXPath = ".//li[@data-testid='games-on-date']/div/span";
    const elements = await matchElement.$$(`xpath/${dateXPath}`);

    if (elements.length > 0) {
      return await elements[0].evaluate((el) => el.textContent.trim());
    } else {
      logger.warn(`Date element not found using XPath: ${dateXPath}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error in scrapeDate: ${error.message}`);
    return null;
  }
}

// Scrapes type, time, and ground information from the match element

// Define types as an array to look up
const typeDefinitions = ["One Day", "Two Day+", "T20"];

async function scrapeTypeTimeGround(matchElement) {
  try {
    // sc-kpDqfm sc-1uurivg-12 htBoat iTeyOw
    const gameInfoXpath = "xpath/.//div[@class='sc-1uurivg-11 jbzXQr']"; // Updated XPath with recent Puppeteer syntax

    const gameInfoElements = await matchElement.$$(`${gameInfoXpath}`);
    if (gameInfoElements.length === 0) {
      logger.warn(`Game info element not found using XPath: ${gameInfoXpath}`);
      return { type: null, time: null, ground: null, dateRangeObj: null };
    }

    // Extract spans within the matched gameInfoElement
    const spans = await gameInfoElements[0].$$("span");
    if (spans.length === 0) {
      logger.warn("No spans found for type, time, and ground extraction.");
      return { type: null, time: null, ground: null, dateRangeObj: null };
    }

    let type = null;
    let time = null;
    let ground = null;
    let dateRangeObj = [];

    for (const span of spans) {
      const spanText = await span.evaluate((el) => el.textContent.trim());

      // Check if the text matches any type in typeDefinitions
      if (typeDefinitions.includes(spanText)) {
        type = spanText;
      }

      // Extract time only if present
      else if (/^\d{1,2}:\d{2} [APM]{2}/.test(spanText)) {
        const match = spanText.match(/^\d{1,2}:\d{2} [APM]{2}/);
        time = match ? match[0] : null;
      }

      // Extract dates in "Day, dd Mon yy" format, handling one or two dates
      const dateMatches = spanText.match(
        /\b[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{2}\b/g
      );
      if (dateMatches) {
        // Only add dates if they're not already in dateRangeObj to avoid duplicates
        dateMatches.forEach((date) => {
          if (!dateRangeObj.includes(date)) {
            dateRangeObj.push(date);
          }
        });
      }
    }

    // Sort dateRangeObj to ensure dates are in the correct order
    if (dateRangeObj.length > 1) {
      dateRangeObj = [dateRangeObj[1], dateRangeObj[0]]; // Preserve order of first and second dates only
    }
    // Convert the latest date in dateRangeObj to a Date object for finalDaysPlay
    if (dateRangeObj.length > 0) {
      const lastDateStr = dateRangeObj[dateRangeObj.length - 1];

      finalDaysPlay = moment
        .tz(lastDateStr, "ddd, DD MMM YY", "Australia/Sydney")
        .format("YYYY-MM-DDTHH:mm:ssZ"); // Format as ISO string with timezone offset
    }
    // Check for an href link for the ground location within gameInfoElement
    const links = await gameInfoElements[0].$$("a");
    if (links.length > 0) {
      ground = await links[0].evaluate((el) => el.textContent.trim());
    }
    return { type, time, ground, dateRangeObj, finalDaysPlay };
  } catch (error) {
    logger.error(`Error in scrapeTypeTimeGround: ${error.message}`);
    return { type: null, time: null, ground: null, dateRangeObj: null };
  }
}

// END

// Scrapes the status from the match element
async function scrapeStatus(matchElement) {
  try {
    const statusXPath =
      ".//li[@data-testid='games-on-date']/div[2]/div[1]/div[1]/div[2]/span";
    const statusElement = await matchElement.$$(`xpath/${statusXPath}`);

    if (statusElement.length > 0) {
      return await statusElement[0].evaluate((el) => el.textContent.trim());
    } else {
      logger.warn(`Status element not found using XPath: ${statusXPath}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error in scrapeStatus: ${error.message}`);
    return null;
  }
}

// Scrapes scorecard URL and game ID information from the game div
async function scrapeScoreCardInfo(gameDiv) {
  try {
    const urlSelector = 'a[data-testid^="fixture-button-"]';
    const urlElement = await gameDiv.$(urlSelector);

    if (urlElement) {
      const urlToScoreCard = await urlElement.evaluate((el) =>
        el.getAttribute("href")
      );
      const gameID = urlToScoreCard.split("/").pop();
      return { urlToScoreCard, gameID };
    } else {
      logger.warn(`Scorecard URL element not found: ${urlSelector}`);
      return { urlToScoreCard: null, gameID: null };
    }
  } catch (error) {
    logger.error(`Error in scrapeScoreCardInfo: ${error.message}`);
    return { urlToScoreCard: null, gameID: null };
  }
}

// Scrapes team information from the game div
async function scrapeTeamsInfo(gameDiv) {
  try {
    const team1XPath =
      ".//li[@data-testid='games-on-date']/div[2]/div[1]/div/div[1]";
    const team2XPath =
      ".//li[@data-testid='games-on-date']/div[2]/div[1]/div/div[3]";

    async function extractTeamInfo(teamElement) {
      const name = await teamElement.$eval("a", (el) => el.textContent.trim());
      const href = await teamElement.$eval("a", (el) =>
        el.getAttribute("href")
      );
      const id = href.split("/").pop();
      return { name, href, id };
    }

    const teams = [];
    const [team1Element, team2Element] = await Promise.all([
      gameDiv.$$(`xpath/${team1XPath}`),
      gameDiv.$$(`xpath/${team2XPath}`),
    ]);

    if (team1Element.length > 0) {
      teams.push(await extractTeamInfo(team1Element[0]));
    } else {
      logger.warn(`Team 1 element not found: ${team1XPath}`);
    }

    if (team2Element.length > 0) {
      teams.push(await extractTeamInfo(team2Element[0]));
    } else {
      logger.warn(`Team 2 element not found: ${team2XPath}`);
    }

    return teams;
  } catch (error) {
    logger.error(`Error in scrapeTeamsInfo: ${error.message}`);
    return [];
  }
}

// Checks if the match is a bye match
async function isByeMatch(matchElement) {
  try {
    const team1XPath =
      ".//li[@data-testid='games-on-date']/div[2]/div[1]/div/div[1]";
    const team2XPath =
      ".//li[@data-testid='games-on-date']/div[2]/div[1]/div/div[3]";

    const team1Elements = await matchElement.$$(`xpath/${team1XPath}`);
    const team2Elements = await matchElement.$$(`xpath/${team2XPath}`);

    return team1Elements.length === 0 || team2Elements.length === 0;
  } catch (error) {
    logger.error(`Error in isByeMatch: ${error.message}`);
    return false;
  }
}

module.exports = {
  scrapeRound,
  scrapeDate,
  scrapeStatus,
  scrapeTypeTimeGround,
  scrapeScoreCardInfo,
  scrapeTeamsInfo,
  isByeMatch,
};

// Developer Notes:
// - The functions in this module are designed for scraping specific data from a sports match webpage.
// - Each function targets a specific data point (e.g., round, date, team info) using XPath or CSS selectors.
// - The isByeMatch function checks for the absence of expected elements to determine if the match is a bye.

// Future Improvements:
// - Continuously monitor and update XPath/CSS selectors to adapt to changes in the webpage structure.
// - Consider implementing more robust error handling to capture specific element failures.
// - Explore opportunities to optimize the scraping performance, especially for pages with many matches.
