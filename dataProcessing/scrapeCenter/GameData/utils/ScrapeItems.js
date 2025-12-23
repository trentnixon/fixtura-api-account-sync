const logger = require("../../../../src/utils/logger");
//const moment = require("moment");
const moment = require("moment-timezone");

// Scrapes the round information from the match element
// isFallback: if true, suppress warnings (used when called on gameDiv as fallback)
async function scrapeRound(matchElement, isFallback = false) {
  try {
    const roundXPath = ".//div[@data-testid='fixture-list']/div/h3";
    const elements = await matchElement.$$(`xpath/${roundXPath}`);

    if (elements.length > 0) {
      return await elements[0].evaluate((el) => el.textContent.trim());
    } else {
      // Only warn if this is not a fallback call (i.e., called on matchElement)
      // When called on gameDiv as fallback, it's expected to fail
      if (!isFallback) {
        logger.warn(`Round element not found using XPath: ${roundXPath}`);
      } else {
        logger.debug(
          `Round element not found using XPath (fallback call, expected): ${roundXPath}`
        );
      }
      return null;
    }
  } catch (error) {
    logger.error(`Error in scrapeRound: ${error.message}`);
    return null;
  }
}

// Scrapes the date information from the match element
async function scrapeDate(gameDiv) {
  try {
    // UPDATED: gameDiv IS the games-on-date div, so XPath should be relative to it
    // Structure: div[data-testid="games-on-date"] > div[1] (first child) > span (date)
    const dateXPath = ".//div[1]/span";
    const elements = await gameDiv.$$(`xpath/${dateXPath}`);

    if (elements.length > 0) {
      return await elements[0].evaluate((el) => el.textContent.trim());
    } else {
      // DIAGNOSTIC: Log structure to help debug
      const structure = await gameDiv.evaluate((el) => {
        return {
          tagName: el.tagName,
          dataTestId: el.getAttribute("data-testid"),
          childCount: el.children.length,
          firstChild: el.children[0]
            ? {
                tagName: el.children[0].tagName,
                className: el.children[0].className,
                hasSpan: !!el.children[0].querySelector("span"),
                spanText:
                  el.children[0].querySelector("span")?.textContent?.trim() ||
                  null,
              }
            : null,
          allSpans: Array.from(el.querySelectorAll("span"))
            .slice(0, 5)
            .map((s) => s.textContent?.trim()),
        };
      });

      logger.warn(`Date element not found using XPath: ${dateXPath}`, {
        xpath: dateXPath,
        structure: structure,
        possibleCause:
          "Date span may be in different location - check structure",
      });
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
      logger.warn(
        `[SCRAPE-DATES] Game info element not found using XPath: ${gameInfoXpath}`
      );
      return {
        type: null,
        time: null,
        ground: null,
        dateRangeObj: null,
        finalDaysPlay: null,
      };
    }
    logger.debug(
      `[SCRAPE-DATES] Found ${gameInfoElements.length} gameInfoElement(s) using XPath: ${gameInfoXpath}`
    );

    // Extract spans within the matched gameInfoElement
    const spans = await gameInfoElements[0].$$("span");
    if (spans.length === 0) {
      logger.warn("No spans found for type, time, and ground extraction.");
      return {
        type: null,
        time: null,
        ground: null,
        dateRangeObj: null,
        finalDaysPlay: null,
      };
    }

    let type = null;
    let time = null;
    let ground = null;
    let dateRangeObj = [];
    let finalDaysPlay = null;

    // OPTIMIZATION: Extract all span texts in parallel (was sequential)
    // This reduces span processing time from 100ms to 30-50ms
    const spanTextPromises = spans.map((span) =>
      span.evaluate((el) => el.textContent.trim())
    );
    const spanTexts = await Promise.all(spanTextPromises);

    // Log all span texts for debugging
    logger.debug(
      `[SCRAPE-DATES] Found ${
        spanTexts.length
      } spans. Span texts: ${JSON.stringify(spanTexts)}`
    );

    // Process span texts sequentially (needed for building dateRangeObj)
    for (const spanText of spanTexts) {
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
      // Matches format like "Sat, 06 Sep 25" from span text like "10:00 AM, Sat, 06 Sep 25"
      // Also handles full day names like "Saturday, 11 Oct 2025" from "11:00 AM, Saturday, 11 Oct 2025"
      // Pattern matches: day name (3+ letters), comma, space, day number, space, month (3 letters), space, year (2-4 digits)
      // Updated regex to be more precise: year must be followed by space, comma, or end of string (not digits)
      // This prevents matching "Sat, 11 Oct 2512" from concatenated strings like "Sat, 11 Oct 2512:00 PM"
      const datePattern =
        /[A-Za-z]{3,}, \d{1,2} [A-Za-z]{3} \d{2,4}(?=\s|,|$)/g;
      const dateMatches = spanText.match(datePattern);
      if (dateMatches) {
        logger.debug(
          `[SCRAPE-DATES] Found date matches in spanText "${spanText}": ${JSON.stringify(
            dateMatches
          )}`
        );
        // Only add dates if they're not already in dateRangeObj to avoid duplicates
        // Also validate that dates can be parsed (filters out invalid matches like "Sat, 11 Oct 2512")
        dateMatches.forEach((date) => {
          if (!dateRangeObj.includes(date)) {
            // Quick validation: try to parse the date to ensure it's valid
            let isValid = false;
            let parsed = moment.tz(date, "ddd, DD MMM YY", "Australia/Sydney");
            if (!parsed.isValid()) {
              parsed = moment.tz(date, "dddd, DD MMM YYYY", "Australia/Sydney");
            }
            if (!parsed.isValid()) {
              parsed = moment.tz(date, "ddd, DD MMM YYYY", "Australia/Sydney");
            }
            isValid = parsed.isValid();

            if (isValid) {
              dateRangeObj.push(date);
            } else {
              logger.debug(
                `[SCRAPE-DATES] Skipping invalid date match: "${date}" (could not be parsed)`
              );
            }
          }
        });
      } else {
        // Log when we expect to find dates but don't (for debugging)
        if (spanText.includes("AM") || spanText.includes("PM")) {
          logger.debug(
            `[SCRAPE-DATES] No date matches found in spanText "${spanText}" (contains time but no date match)`
          );
        }
      }
    }

    // Sort dateRangeObj chronologically to ensure dates are in the correct order
    // For two-day games, we need to sort by actual date value, not just swap positions
    if (dateRangeObj.length > 1) {
      // Parse and sort dates chronologically
      const parsedDates = dateRangeObj.map((dateStr) => {
        // Try parsing with different formats
        let parsed = moment.tz(dateStr, "ddd, DD MMM YY", "Australia/Sydney");
        if (!parsed.isValid()) {
          parsed = moment.tz(dateStr, "dddd, DD MMM YYYY", "Australia/Sydney");
        }
        if (!parsed.isValid()) {
          parsed = moment.tz(dateStr, "ddd, DD MMM YYYY", "Australia/Sydney");
        }
        return { dateStr, parsed };
      });

      // Filter out invalid dates and sort by date value
      const validDates = parsedDates.filter((d) => d.parsed.isValid());
      validDates.sort((a, b) => a.parsed.valueOf() - b.parsed.valueOf());

      // Update dateRangeObj with sorted dates (chronological order)
      dateRangeObj = validDates.map((d) => d.dateStr);

      logger.debug(
        `[SCRAPE-DATES] Sorted ${
          dateRangeObj.length
        } dates chronologically: ${JSON.stringify(dateRangeObj)}`
      );
    }

    // Convert the latest date in dateRangeObj to a Date object for finalDaysPlay
    // For two-day games, this will be the final day of play (the last date chronologically)
    if (dateRangeObj.length > 0) {
      const lastDateStr = dateRangeObj[dateRangeObj.length - 1];

      // Try parsing with different formats to handle both "Sat, 06 Sep 25" and "Saturday, 11 Oct 2025"
      let parsedDate = null;
      // Try 3-letter day abbreviation with 2-digit year first (most common)
      parsedDate = moment.tz(lastDateStr, "ddd, DD MMM YY", "Australia/Sydney");
      if (!parsedDate.isValid()) {
        // Try full day name with 4-digit year
        parsedDate = moment.tz(
          lastDateStr,
          "dddd, DD MMM YYYY",
          "Australia/Sydney"
        );
      }
      if (!parsedDate.isValid()) {
        // Try 3-letter day abbreviation with 4-digit year
        parsedDate = moment.tz(
          lastDateStr,
          "ddd, DD MMM YYYY",
          "Australia/Sydney"
        );
      }

      if (parsedDate.isValid()) {
        // Strapi expects YYYY-MM-DD format only (deprecated ISO format with time/timezone)
        finalDaysPlay = parsedDate.format("YYYY-MM-DD");
        logger.debug(
          `[SCRAPE-DATES] finalDaysPlay set to: ${finalDaysPlay} (from date: ${lastDateStr})`
        );
      } else {
        logger.warn(`[SCRAPE-DATES] Failed to parse date: "${lastDateStr}"`);
      }
    }
    // Check for an href link for the ground location within gameInfoElement
    const links = await gameInfoElements[0].$$("a");
    if (links.length > 0) {
      ground = await links[0].evaluate((el) => el.textContent.trim());
    }

    // Log scraped date values for debugging
    logger.debug(
      `[SCRAPE-DATES] dateRangeObj: ${JSON.stringify(
        dateRangeObj
      )}, finalDaysPlay: ${finalDaysPlay}`
    );

    return { type, time, ground, dateRangeObj, finalDaysPlay };
  } catch (error) {
    logger.error(`Error in scrapeTypeTimeGround: ${error.message}`);
    return {
      type: null,
      time: null,
      ground: null,
      dateRangeObj: null,
      finalDaysPlay: null,
    };
  }
}

// END

// Scrapes the status from the match element
async function scrapeStatus(gameDiv) {
  try {
    // UPDATED: gameDiv IS the games-on-date div, so XPath should be relative to it
    // Structure: div[data-testid="games-on-date"] > div[2] (listitem) > div[1] > div[1] > div[2] > span (status)
    const statusXPath = ".//div[2]/div[1]/div[1]/div[2]/span";
    const statusElement = await gameDiv.$$(`xpath/${statusXPath}`);

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
    // UPDATED: gameDiv IS the games-on-date div, so XPath should be relative to it
    // Structure: div[data-testid="games-on-date"] > div[role="listitem"] > div[2]/div[1]/div/div[1] (team1)
    const team1XPath = ".//div[2]/div[1]/div/div[1]";
    const team2XPath = ".//div[2]/div[1]/div/div[3]";

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
// UPDATED: gameDiv is already div[data-testid="games-on-date"], so XPath should be relative to it
async function isByeMatch(gameDiv) {
  try {
    // UPDATED: gameDiv IS the games-on-date div, so we don't need to search for it again
    // Structure: div[data-testid="games-on-date"] > div[role="listitem"] > div[2]/div[1]/div/div[1] (team1)
    const team1XPath = ".//div[2]/div[1]/div/div[1]";
    const team2XPath = ".//div[2]/div[1]/div/div[3]";

    const team1Elements = await gameDiv.$$(`xpath/${team1XPath}`);
    const team2Elements = await gameDiv.$$(`xpath/${team2XPath}`);

    const isBye = team1Elements.length === 0 || team2Elements.length === 0;

    if (isBye) {
      logger.debug(
        `[BYE-MATCH] Detected bye match - team1: ${team1Elements.length}, team2: ${team2Elements.length}`,
        {
          team1Found: team1Elements.length > 0,
          team2Found: team2Elements.length > 0,
        }
      );
    }

    return isBye;
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
