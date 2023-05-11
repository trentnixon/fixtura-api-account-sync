// Utils
const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");

// VARS
const Domain = "https://www.playhq.com";

class getFixtureResults {
  constructor() {
    this.browser = null;
  }

  setBrowser(browser) {
    this.browser = browser;
  }

  async Setup(Teams) {
    //console.log("FIXTURES", Teams);
    const page = await this.browser.newPage();
    let teamIndex = 0;
    //console.log("TRY AND RUN THIS");
    try {
      //console.log("TRY THIS", Teams);
      for (const { id, attributes: team } of Teams.data) {
        //console.log(team);
        //console.log("team.teamName ", team.teamName);
        logger.info(`Processing team ${team.teamName}`);

        const filteredData = team.game_meta_data.data
          .filter((item) =>
            ["Final", "Abandoned"].includes(item.attributes.status)
          )
          .filter(
            (item) =>
              item.attributes.isFinished === null ||
              item.attributes.isFinished === false
          );

        logger.info(
          `${team.teamName} has ${filteredData.length} Games to Look up this week, (Index ${teamIndex})...`
        );
        if (filteredData.length > 0) {
          for (const { id, attributes: fixture } of filteredData) {
            logger.info(`Processing fixture Fixid ${id}`);
            const url = `${Domain}${fixture.urlToScoreCard}`;
            logger.info(`Looking for games on URL ${url}`);
            const scorecard = await this.getFixtureScorecard(page, url);

            await this.UpdateScorecard(scorecard, id);
          }
        } else {
          logger.info(`No fixtures found for team ${team.teamName}`);
        }
        teamIndex++;
      }
    } catch (error) {
      logger.error(
        `Error getting team game data: teamIndex : ${teamIndex}`,
        error
      );
    }  finally {
      const disposeResult = await this.dispose();
      //console.log(disposeResult)
      return true;
    }
  }

  async getFixtureScorecard(page, url) {
    try {
      await page.goto(url);
      const GameDetails = await this.getGameDetails(page);
      const scorecards = await this.scrapeScorecards(page);
      const result = {
        GameDetails: { ...GameDetails },
        scorecard: { ...scorecards },
      };
      return result;
    } catch (error) {
      logger.error("Error in getFixtureScorecard:", error);
      return {};
    } finally {
      await page.close();
    }
  }

  async getGameDetails(page) {
    try {
      const details = await page.evaluate(() => {
        const headerEl = document.querySelector(".sc-1swl5w-1");
        const scoresEl = document.querySelector(".sc-1swl5w-3.kFhDtN");
        const typeEl = document.querySelector(".sc-1swl5w-16");
        const tossEl = document.querySelector(".sc-jrsJCI.eDeiIe");

        const status = headerEl
          ? headerEl.querySelector("span").textContent.trim()
          : "";

        if (status === "Abandoned" || status === "Cancelled") {
          return { status };
        }

        const teamHomeEl = scoresEl
          ? scoresEl.querySelector(".sc-1swl5w-7:nth-child(1) a")
          : null;
        const teamAwayEl = scoresEl
          ? scoresEl.querySelector(".sc-1swl5w-7:nth-child(2) a")
          : null;

        const teamHomeName = teamHomeEl ? teamHomeEl.textContent.trim() : "";
        const teamAwayName = teamAwayEl ? teamAwayEl.textContent.trim() : "";
        const Homescores = scoresEl
          ? scoresEl.querySelector(".sc-1swl5w-12 .fHOOPF").textContent.trim()
          : "";
        const HomeOvers = scoresEl
          ? scoresEl.querySelector(".sc-1swl5w-12 .gxGdCn").textContent.trim()
          : "";
        const Awayscores = scoresEl
          ? scoresEl.querySelector(".sc-1swl5w-13 .fHOOPF").textContent.trim()
          : "";
        const AwayOvers = scoresEl
          ? scoresEl.querySelector(".sc-1swl5w-13 .gxGdCn").textContent.trim()
          : "";

        const type = typeEl
          ? typeEl.querySelector(".sc-bqGHjH").textContent.trim()
          : "";
        const dateRange = typeEl
          ? typeEl.querySelector(".sc-bqGHjH:nth-child(2)").textContent.trim()
          : "";
        const venue = typeEl
          ? typeEl.querySelector(".sc-1swl5w-18 a").textContent.trim()
          : "";
        const venueLink = typeEl
          ? typeEl.querySelector(".sc-1swl5w-18 a").href
          : "";
        const competition = typeEl
          ? typeEl.querySelector(".sc-bqGHjH:nth-child(4)").textContent.trim()
          : "";
        const competitionLink = typeEl
          ? typeEl.querySelector(".sc-bqGHjH:nth-child(4) a").href
          : "";

        const tossResult = tossEl
          ? tossEl.querySelector(".gXUjpw").textContent.trim()
          : "";

        let tossWinner = null;
        if (tossResult) {
          if (tossResult.includes(teamHomeName)) {
            tossWinner = teamHomeName;
          } else if (tossResult.includes(teamAwayName)) {
            tossWinner = teamAwayName;
          }
        }

        return {
          status,
          teamHomeName,
          Homescores,
          HomeOvers,
          teamAwayName,
          Awayscores,
          AwayOvers,
          name: type,
          dateRange,
          venue,
          venueLink,
          competition,
          competitionLink,
          tossWinner,
          tossResult,
        };
      });

      return details;
    } catch (error) {
      console.error("Error in getGameDetails:", error);
      return {};
    }
  }

  async scrapeScorecards(page) {
    // Wait for the scorecards to load
    await page.waitForSelector(".sc-jrsJCI.eTnWgS");

    // Get the innings buttons
    const inningsButtons = await page.$$(
      '[data-testid="period-tab-container"] button'
    );

    // Initialize the scorecard object
    const scorecards = {};

    // Loop through the innings buttons
    for (let i = 0; i < inningsButtons.length; i++) {
      const inningsButton = inningsButtons[i];

      // Click the button
      await inningsButton.click();

      // Wait for the scorecard to load
      await page.waitForSelector(".sc-jrsJCI.glcFNO span");

      // Get the name of the innings
      const elementHandles = await page.$$(".sc-jrsJCI.ktPSBm");
      const BattinginningsName = await elementHandles[0].evaluate((el) =>
        el.textContent.trim()
      );
      const BowlinginningsName = await elementHandles[1].evaluate((el) =>
        el.textContent.trim()
      );

      // Get the table headers
      const Battingheaders = await page.$$eval(
        ".sc-jrsJCI.gFvRUe.sc-1x5e4rc-0.dSIIez span",
        (headers) => headers.map((header) => header.textContent)
      );
      const Bowlingheaders = await page.$$eval(
        ".sc-jrsJCI.cuDESF.p1xzbi-0.hnHxCF span",
        (headers) => headers.map((header) => header.textContent)
      );

      const elementInngingsResults = await page.$$(".c5jfdg-2.ihUGeK");
      const battingRows = await elementInngingsResults[0].$$eval(
        ".zcQYy:not(:first-child)",
        (rows) =>
          rows.map((row) => {
            const cells = row.querySelectorAll("span");
            return Array.from(cells).map((cell) => cell.textContent);
          })
      );

      const bowlingRows = await elementInngingsResults[1].$$eval(
        ".kiekoR:not(:first-child)",
        (rows) =>
          rows.map((row) => {
            const cells = row.querySelectorAll("span");
            return Array.from(cells).map((cell) => cell.textContent);
          })
      );

      let fowString;
      let FOW;
      const fowElement = await page.$(".sc-jrsJCI.iWhyhI span.hXclEb");
      if (fowElement) {
        fowString = await fowElement.evaluate((el) => el.textContent);
        FOW = fowString.split(",").map((item) => item.trim());
      } else {
        fowString = null; // or set to some other default value
        FOW = [];
      }

      // Create the scorecard object
      const scorecard = {
        BattinginningsName,
        BowlinginningsName,
        Battingheaders,
        Bowlingheaders,
        battingRows,
        bowlingRows,
        FOW,
      };

      // Add the scorecard object to the scorecards object
      scorecards[`innings${i + 1}`] = scorecard;
    }

    //console.log("scorecards", scorecards.innings1)
    return scorecards;
  }

  async UpdateScorecard(Scorecard, gameId) {
    //console.log(`Update Entry for game ${gameId}`);

    // Abandoned Final
    await fetcher(`game-meta-datas/${gameId}`, "PUT", {
      data: Scorecard.GameDetails,
    });
    await fetcher(`game-meta-datas/${gameId}`, "PUT", {
      data: {
        scorecards: Scorecard.scorecard,
        isFinished:
          Scorecard.GameDetails.status === "Final" ||
          Scorecard.GameDetails.status === "Abandoned"
            ? true
            : false,
      },
    });

    return { updated: true };
  }

  async dispose() {
    const pages = await this.browser.pages();
    for (const page of pages) {
      await page.close();
    }
    return true;
  }
}

module.exports = getFixtureResults;
