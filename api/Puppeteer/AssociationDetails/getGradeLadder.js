const logger = require("../../Utils/logger");

const fetcher = require("../../Utils/fetcher");

class getGradeLadders {
  constructor(TEAMS, ActiveGrades) {
    this.browser = null;
    this.TEAMS = TEAMS.data;
    this.ActiveGrades = ActiveGrades;
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

  async Setup() {
    try {
      const page = await this.browser.newPage();
      await this.LoopTeams(page);
      await page.close();
      return true;
    } catch (error) {
      logger.error("Error during setup:", error);
      return false;
    }
  }

  async LoopTeams(page) {
    let teamIndex = 0;
    try {
      for (const { id, attributes: team } of this.TEAMS) {
        console.log("team.grades.data.id ", team.grades.data);
        logger.info(`Processing team ${team.teamName} (Index ${teamIndex})...`);
        logger.info(`on playHQ URL ${team.href}/ladder`);
        // Navigate to team page

        await page.goto(`${team.href}/ladder`);
        //console.log(await page.content());
        // Find the Current grades ladder for processing
        const ladderData = await this.ScrapeLadderData(page);

        //console.log(ladderData);
        team.grades.data.map(async (grade, i) => {
          if (grade?.id !== undefined) {
            await this.putNewLadder(ladderData, grade.id);
          }
        });
    
        teamIndex++;
      }
      return true;
    } catch (error) {
      logger.error("Error getting team game data:", error);
      return false;
    }
  }

  async putNewLadder(Ladder, ID) {
    try {
      return await fetcher(`grades/${ID}`, "PUT", { data: { ladder: Ladder } });
    } catch (error) {
      logger.error("Error putting new ladder:", error);
      return false;
    }
  }

  async ScrapeLadderData(page) {
    try {

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

      //console.log("Finished scraping ladder data");
      return teams;
    } catch (error) {
      console.log("Error scraping ladder data:");
      console.log(error.message);
      console.log("Error stack trace:");
      console.log(error.stack);
      return [];
    }
  }
  async dispose() {}
}

module.exports = getGradeLadders;
