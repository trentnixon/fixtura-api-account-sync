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

      logger.debug("Competitions fetched");
      //console.log("competitions", competitions)
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
    //console.log("extractCompetitionsData IS RUNNING", this.associationID);
    try {
        return await this.page.evaluate((associationID) => {
            const result = [];
            // Selecting the container that includes both the h2 and ul elements.
            const seasonOrgs = Array.from(document.querySelectorAll('[data-testid^="season-org-"]'));
            if (!seasonOrgs.length) {
                console.error("No seasonOrgs found");
                throw new Error("No season organizations found on the page.");
            }

            seasonOrgs.forEach((seasonOrg) => {
                // First, capture the competition name, which is the text content of the h2 element in each seasonOrg.
                const competitionName = seasonOrg.querySelector("h2") ? seasonOrg.querySelector("h2").textContent.trim() : "Unknown Competition Name";

                const competitions = seasonOrg.querySelectorAll("ul > li > a");
                if (!competitions.length) {
                    console.error("No competitions found within seasonOrg");
                    return; // Skip this iteration as no competitions found within this seasonOrg
                }

                competitions.forEach((comp) => {
                    const season = comp.querySelector("span:nth-child(1)") ? comp.querySelector("span:nth-child(1)").textContent.trim() : "Unknown Season";
                    const dateSpan = comp.querySelector("span:nth-child(2)");
                    const [startDate, endDate] = dateSpan ? dateSpan.textContent.split(" — ").map(date => date.trim()) : ["Unknown Start Date", "Unknown End Date"];
                    const status = comp.querySelector("div > span") ? comp.querySelector("div > span").textContent.trim() : "Unknown Status";
                    const url = comp.href;
                    const competitionId = url.split("/").slice(-1)[0];

                    result.push({
                        competitionName, // Using the captured name
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

