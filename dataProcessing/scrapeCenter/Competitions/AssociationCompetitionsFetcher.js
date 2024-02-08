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
        `Checking competitions in fetchCompetitionInAssociation on URL: ${this.url}`
      );
      await this.navigateToUrl();
      await this.waitForPageLoad();
      const competitions = await this.extractCompetitionsData();
    
      logger.debug("Competitions fetched");
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
    return await this.page.evaluate((associationID) => {
      const seasonOrgs = Array.from(
        document.querySelectorAll('[data-testid^="season-org-"]')
      );
      return seasonOrgs.flatMap((seasonOrg) => {
        const competitionElements = Array.from(
          seasonOrg.querySelectorAll("h2")
        );
        return competitionElements.map((competitionElement) => {
          const competitionName = competitionElement.textContent.trim();
          const anchorElement =
            competitionElement.nextElementSibling.querySelector("a");
          const season = anchorElement
            .querySelector("span:nth-child(1)")
            .textContent.trim();
          const dateSpan = anchorElement.querySelector("span:nth-child(2)");
          const [startDate, endDate] = dateSpan.textContent
            .split(" — ")
            .map((date) => date.trim());
          const status = anchorElement
            .querySelector("div > span")
            .textContent.trim();
          const url = anchorElement.href;
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
        });
      });
    }, this.associationID);
  }

  extractIdFromUrl(url) {
    return url.split("/").slice(-1)[0];
  }
}

module.exports = AssociationCompetitionsFetcher;
