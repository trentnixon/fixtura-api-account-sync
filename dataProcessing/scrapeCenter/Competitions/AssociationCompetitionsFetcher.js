const logger = require("../../../src/utils/logger");

class AssociationCompetitionsFetcher {
  constructor(page, url, associationID) {
    this.page = page;
    this.url = url;
    this.associationID = associationID;
  }

  async fetchCompetitions() {
    try {
      logger.debug(
        `Checking competitions in fetchCompetitionInAssociation on URL: ${this.url} and this ID ${this.associationID}`
      );
      await this.navigateToUrl();
      await this.waitForPageLoad();
      const competitions = await this.extractCompetitionsData();

      //console.log("[fetchCompetitions]", competitions);

      return competitions;
    } catch (error) {
      logger.error(`Error in fetching competitions for association: ${error}`);
      throw error;
    }
  }

  async navigateToUrl() {
    await this.page.goto(this.url);
  }

  async waitForPageLoad() {
    await this.page.waitForSelector('[data-testid^="season-org-"]');
  }

  async extractCompetitionsData() {
    try {
      return await this.page.evaluate((associationID) => {
        const result = [];

        // Select the parent block (the entire container with all competitions)
        const seasonOrgsParent = document.querySelector(
          '[data-testid^="season-org-"]'
        );

        if (!seasonOrgsParent) {
          console.error("No seasonOrgs found");
          throw new Error("No season organizations found on the page.");
        }

        // Loop over the child divs within the parent block
        const seasonOrgs = Array.from(seasonOrgsParent.children);

        // Iterate over each child div (which contains an h2 and competition list)
        seasonOrgs.forEach((seasonOrg, index) => {
          // Get the competition name from the current div
          const competitionNameElement = seasonOrg.querySelector("h2");
          const competitionName = competitionNameElement
            ? competitionNameElement.textContent.trim()
            : `Unknown Competition Name ${index}`;

          // Extract competition details within the same seasonOrg
          const competitions = seasonOrg.querySelectorAll("ul > li > a");
          if (!competitions.length) {
            console.error(
              `No competitions found within seasonOrg ${index + 1}`
            );
            return; // Skip if no competitions found
          }

          // Iterate over each competition inside the current seasonOrg
          competitions.forEach((comp, compIndex) => {
            const season = comp.querySelector("span:nth-child(1)")
              ? comp.querySelector("span:nth-child(1)").textContent.trim()
              : `Unknown Season ${compIndex}`;
            const dateSpan = comp.querySelector("span:nth-child(2)");
            const [startDate, endDate] = dateSpan
              ? dateSpan.textContent.split(" — ").map((date) => date.trim())
              : ["Unknown Start Date", "Unknown End Date"];
            const status = comp.querySelector("div > span")
              ? comp.querySelector("div > span").textContent.trim()
              : "Unknown Status";
            const url = comp.href;
            const competitionId = url.split("/").slice(-1)[0];

            // Push the competition data into the result array
            result.push({
              competitionName, // The correct competition name from this seasonOrg
              season,
              startDate,
              endDate,
              status,
              url,
              competitionId,
              association: associationID,
            });
          });
        });

        return result;
      }, this.associationID);
    } catch (error) {
      logger.error(`Error in extractCompetitionsData: ${error}`);
      throw error; // Rethrow the error after logging
    }
  }

  // This function will be stringified and passed to evaluate, hence it needs to be fully self-contained.
  extractCompetitionData(competitionElement, associationID) {
    //("extractCompetitionData is HERE")
    const competitionName = competitionElement.textContent.trim();
    const anchorElement = competitionElement.nextElementSibling;
    if (!anchorElement)
      throw new Error("Anchor element not found for competitionElement");

    const link = anchorElement.querySelector("a");
    if (!link) throw new Error("Link not found for anchorElement");

    const seasonSpan = link.querySelector("span:nth-child(1)");
    if (!seasonSpan) throw new Error("Season span not found");

    const dateSpan = link.querySelector("span:nth-child(2)");
    if (!dateSpan) throw new Error("Date span not found");

    const statusSpan = link.querySelector("div > span");
    if (!statusSpan) throw new Error("Status span not found");

    const season = seasonSpan.textContent.trim();
    const [startDate, endDate] = dateSpan.textContent
      .split(" — ")
      .map((date) => date.trim());
    const status = statusSpan.textContent.trim();
    const url = link.href;
    const competitionId = url.split("/").slice(-1)[0];

    return {
      competitionName,
      season,
      startDate,
      endDate,
      status,
      url,
      competitionId,
      association: [associationID],
    };
  }

  extractIdFromUrl(url) {
    return url.split("/").slice(-1)[0];
  }
}

module.exports = AssociationCompetitionsFetcher;
