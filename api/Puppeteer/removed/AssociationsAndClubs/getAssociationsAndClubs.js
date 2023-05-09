const assignAssociationsAndClubs = require("./assignAssociationsAndClubs");
const logger = require("../../Utils/logger");

class getAssociationsAndClubs {
  constructor(browser) {
    this.browser = browser;
  }

  async Setup(PATH, fetchAllPages = true) {
    if (PATH === undefined) {
      logger.error("Invalid path provided.");
      return false;
    }

    const BASEURL = `https://www.playhq.com/${PATH}/`;
    logger.info(`BASEURL: ${BASEURL}`);
    logger.info("Starting getAssociationsAndClubs.Setup");

    const page = await this.browser.newPage();

    try {
      await page.goto(BASEURL);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "screenshot.png" });
    } catch (error) {
      logger.error(`Error while navigating to the URL: ${error}`);
      await page.close();
      throw error;
    }

    const data = {
      associations: [],
      clubs: [],
    };

    let hasNextPage = true;

    while (hasNextPage) {
      let elements;
      try {
        elements = await page.$$(".rrryeq-0");
        logger.info(`Found elements: ${elements.length}`);
      } catch (error) {
        logger.error(`Error while fetching elements: ${error}`);
        await page.close();
        throw error;
      }

      const dataPerPage = await Promise.all(
        elements.map(async (element) => {
          const aElement = await element.$(".rrryeq-1");
          const href = await (aElement
            ? aElement.evaluate((node) => node.href)
            : null);
          const PlayHQID = href
            ? href.substring(href.lastIndexOf("/") + 1)
            : null;

          const titleElement = await element.$(".rrryeq-2");
          const Name = await (titleElement
            ? titleElement.evaluate((node) => node.textContent.trim())
            : null);

          const typeElement = await element.$(
            '.rrryeq-3 > span[class^="sc-bqGHjH"]'
          );
          const type = await (typeElement
            ? typeElement.evaluate((node) => node.textContent.trim())
            : null);

          logger.info(`Extracted data: ${JSON.stringify({ href, Name, type, PlayHQID })}`);

          return { href, Name, type, PlayHQID };
        })
      );

      dataPerPage.forEach((item) => {
        if (item.type === "Association") {
          data.associations.push(item);
        } else if (item.type === "Club") {
          data.clubs.push(item);
        }
      });

      logger.info(`Fetched ${dataPerPage.length} elements.`);

      if (!fetchAllPages) break;

      const nextPageButton = await page.$('a[data-testid="page-next"]');
      if (nextPageButton) {
        const nextPageUrl = await nextPageButton.evaluate((node) => node.href);
        await page.goto(nextPageUrl);
        await page.waitForTimeout(2000);
      } else {
        hasNextPage = false;
      }
    }

    await page.close();

    logger.info("Uploading data.");
    const uploader = new assignAssociationsAndClubs();
    uploader.UploadData(data);

    logger.info("Finished getAssociationsAndClubs.Setup.");
  }
}

module.exports = getAssociationsAndClubs;
