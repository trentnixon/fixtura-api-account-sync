const logger = require("../../Utils/logger");
const fetcher = require("../../Utils/fetcher");
const qs = require("qs");
const assignGradesToCompetitions = require("./assignGradesToCompetitions");

function createQuery(pageCounter) {
  return qs.stringify(
    {
      pagination: {
        start: pageCounter * 25,
        limit: 25,
      },
      encodeValuesOnly: true,
    }
  );
}

class getCompetitionGrades {
  setBrowser(browser) {
    this.browser = browser;
  }

  async fetchCompetitions(pageCounter) {
    const query = createQuery(pageCounter);
    return await fetcher(`competitions/?${query}`);
    //return await fetcher(`competitions/941`);
    
  }

  async processCompetition(page, competition) {
    logger.info(`Processing competition ID ${competition.id} on ${competition.attributes.url}`);
  
    if (!competition.attributes.url.startsWith("http")) {
      logger.error(`Invalid URL for competition ID ${competition.id}`);
      logger.error(`The Path ${competition.attributes.url}`);
      return;
    }
  
    await page.goto(competition.attributes.url);
    await page.waitForSelector('ul[data-testid="grades-list"]');
  
    const grades = await page.evaluate((competitionId) => {
      return Array.from(
        document.querySelectorAll(
          'ul[data-testid="grades-list"] > li:not(:first-child)'
        )
      ).map((element) => {
        const gradeName = (
          element.querySelector("span:nth-child(1)")?.textContent || ""
        ).trim();
        const daysPlayed = (
          element.querySelector("span:nth-child(2)")?.textContent || ""
        ).trim();
        const gender = (
          element.querySelector("span:nth-child(3)")?.textContent || ""
        ).trim();
        const ageGroup = (
          element.querySelector("span:nth-child(4)")?.textContent || ""
        ).trim();
        const url = element.querySelector("a")?.href || "";
        const gradeId = url ? url.split("/").slice(-1)[0] : null;
        return {
          gradeName,
          daysPlayed,
          gender,
          ageGroup,
          url,
          gradeId,
          competition: [competitionId],
        };
      });
    }, competition.id);
  
    //console.log("Grades:", grades);
    const uploader = new assignGradesToCompetitions();
    const result = await uploader.Setup(grades);
    logger.info(`Has the upload been completed? ${result.success}`);
  }
  

  async Setup() {
    const page = await this.browser.newPage(); // Use the provided browser instance

    let pageCounter = 0;
    let competitions;

    do {
      pageCounter++;
      competitions = await this.fetchCompetitions(pageCounter);
      
      logger.info(`Processing page ${pageCounter}, found ${competitions.length} competitions`);

      for (const competition of competitions) {
        try {
          await this.processCompetition(page, competition);
        } catch (error) {
          logger.error(`Error processing competition ${competition.id}:`, error);
          continue;
        }
      }
    } while (competitions.length > 0);

    await page.close(); // Close the page after processing
  }

  dispose() {
    // Add any cleanup logic if necessary
  }
}

module.exports = getCompetitionGrades;