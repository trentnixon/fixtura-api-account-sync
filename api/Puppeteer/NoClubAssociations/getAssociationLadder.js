const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");

class GetAssociationLadder {
  constructor() {
    this.browser = null;
    this.Selector = {
      parent: 'div[data-testid="ladder"]',
      firstTable: "div.d3hddp-4.bYBGJx > table.d3hddp-2.jyUxWY",
      secondTable: "table.d3hddp-2.jyUxWY:nth-child(2)",
      teamName: "td:nth-child(2) a",
      firstTableRow: "div.d3hddp-4.bYBGJx > table.d3hddp-2.jyUxWY > tbody > tr",
      dataRow: "table.d3hddp-2.jyUxWY:nth-child(2) > tbody > tr",
    };
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  extractGrades(data) {
    const gradeArray = data.map((item) => item.attributes.grade);

    const uniqueGrades = gradeArray.reduce((unique, current) => {
      if (
        !unique.some(
          (grade) =>
            grade.data.attributes.competitionName ===
            current.data.attributes.competitionName
        )
      ) {
        unique.push(current);
      }
      return unique;
    }, []);

    const formattedGrades = uniqueGrades.map((grade) => ({
      id: grade.data.id,
      gradeName: grade.data.attributes.gradeName,
      url: grade.data.attributes.url,
      ladder: grade.data.attributes.ladder,
    }));

    return formattedGrades;
  }

  async setup(competition) {
    const page = await this.browser.newPage();
    const grades = this.extractGrades(competition.attributes.teams.data);
    try {
      const allTeamData = [];
      for (const item of grades) {
        logger.info(`Processing item with id ${item.id}`);
        const url = item.url;
        logger.info(`${url}/ladder`);
        await page.goto(`${url}/ladder`);

        const ladderData = await this.scrapeLadderData(page);

        allTeamData.push(
          ...ladderData.map((team) => ({
            ...team,
            competition: competition.id,
            grade: item.id,
          }))
        );

        logger.info(`Finished processing item with id ${item.id}`);
        await this.putNewLadder(allTeamData, item.id);
      }
      return true;
    } catch (err) {
      logger.error("Error in setup:", err);
    } finally {
      await page.close();
    }
  }

  async scrapeLadderData(page) {
    try {
      logger.info("Starting to scrape ladder data...");

      await page.waitForSelector(this.Selector.parent, { timeout: 10000 });
      const parentElement = await page.$(this.Selector.parent);

      const firstTableElement = await parentElement.$(this.Selector.firstTable);
      const secondTableElement = await parentElement.$(
        this.Selector.secondTable
      );

      const teams = await page.$$eval(
        this.Selector.firstTableRow,
        (rows, teamNameSelector) =>
          rows.map((row) => ({
            position: row.querySelector("td:nth-child(1)").innerText.trim(),
            teamName: row.querySelector(teamNameSelector).innerText.trim(),
            teamHref: row.querySelector(teamNameSelector).getAttribute("href"),
          })),
        this.Selector.teamName
      );

      const dataRows = await secondTableElement.$$(this.Selector.dataRow);
      for (let i = 0; i < dataRows.length; i++) {
        const data = await dataRows[i].$$eval("td", (cells) =>
          cells.map((cell) => cell.innerText.trim())
        );

        teams[i] = {
          ...teams[i],
          PLAYED: data[0],
          PTS: data[1],
          netRunRate: data[2],
          W: data[3],
          L: data[4],
          D: data[5],
          NR: data[6],
          BYE: data[7],
        };
      }

      logger.info("Finished scraping ladder data");
      return teams;
    } catch (error) {
      logger.error("Error scraping ladder data:", error);
      return [];
    }
  }

  async putNewLadder(Ladder, ID) {
    try {
      const response = await fetcher(`grades/${ID}`, "PUT", {
        data: { ladder: Ladder },
      });
      return response;
    } catch (error) {
      logger.error(`Error in putNewLadder for ID ${ID}:, error`);
      throw error;
    }
  }
}

module.exports = GetAssociationLadder;