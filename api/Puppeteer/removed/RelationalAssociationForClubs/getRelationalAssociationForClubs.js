const logger = require("../../Utils/logger");
const fetcher = require("../../Utils/fetcher");
const qs = require("qs");

class getRelationalAssociationForClubs {
  setBrowser(browser) {
    this.browser = browser;
  }

  async fetchClubs(pageNumber) {
    const queryWithPagination = qs.stringify(
      {
        pagination: {
          page: pageNumber,
          pageSize: 25,
        },
        populate: ["associations"],
      },
      {
        encodeValuesOnly: true,
      }
    );
    return await fetcher(`clubs?${queryWithPagination}`);
  }

  async processClub(page, club) {
    logger.info(`Processing club ${club.attributes.Name} on ${club.attributes.href}`);

    await page.goto(club.attributes.href);
    await page.waitForSelector(".sc-bqGHjH.e3sm8r-1.kEetOu.exbOce, .sc-bqGHjH.bJxBxZ");

    const organizationNames = await page.$$eval(
      ".sc-bqGHjH.e3sm8r-1.kEetOu.exbOce",
      (elements) => elements.map(el => el.textContent.trim())
    );

    if (organizationNames.length === 0) {
      logger.warn(`Club ${club.attributes.Name} does not have a valid organization name.`);
      await this.storeAssociationToClub(club.id, { associations: [392] });
      return;
    }

    const associationsPromises = organizationNames.map(orgName => this.findAssociation(orgName));
    const associationsArrays = await Promise.all(associationsPromises);

    const associationsIds = associationsArrays.flatMap(arr => arr.map(assoc => assoc.id));

    await this.storeAssociationToClub(club.id, { associations: associationsIds });
  }

  async findAssociation(organizationName) {
    logger.info(`Finding association for organization name: ${organizationName}`);
    return await fetcher(`associations?${this.createQSLookup(organizationName)}`);
  }

  async storeAssociationToClub(id, data) {
    logger.info(`Storing association for club ID: ${id}`);
    return await fetcher(`clubs/${id}`, "PUT", { data: data });
  }

  createQSLookup(NAME) {
    return qs.stringify(
      {
        filters: {
          Name: {
            $eq: NAME,
          },
        },
      },
      {
        encodeValuesOnly: true,
      }
    );
  }

  async Setup() {
    const page = await this.browser.newPage();

    let currentPage = 1;
    while (true) {
      const clubsWithoutAssociation = await this.fetchClubs(currentPage);
      logger.info(
        `Found ${clubsWithoutAssociation.length} clubs without a relational association on page ${currentPage}.`
      );

      if (clubsWithoutAssociation.length === 0) {
        break;
      }

      for (const club of clubsWithoutAssociation) {
        try {
          await this.processClub(page, club);
        } catch (error) {
          logger.error(`Error processing club ${club.attributes.Name}:`, error);
          await this.storeAssociationToClub(club.id, { associations: [392] });
        }
      }

      currentPage++;
    }

    await page.close();
  }

  dispose() {
    // Add any cleanup logic if necessary
  }
}

module.exports = getRelationalAssociationForClubs;
