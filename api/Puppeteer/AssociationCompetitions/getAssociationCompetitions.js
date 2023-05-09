const logger = require("../../Utils/logger");
const fetcher = require("../../Utils/fetcher");
const qs = require("qs");
const assignCompetitionsToAssociation = require("./assignCompetitionsToAssociation");

function createQuery(pageNumber) {
  return qs.stringify(
    {
      pagination: {
        page: pageNumber,
        pageSize: 25,
      },
    },
    {
      encodeValuesOnly: true,
    }
  );
}

class getAssociationCompetitions {
  setBrowser(browser) {
    this.browser = browser;
  }

  async fetchAssociations(pageNumber) {
    const query = createQuery(pageNumber);
    return await fetcher(`associations?${query}`);
  }

  async processAssociation(page, association) {
    logger.info(
      `Processing association ${association.attributes.Name} on ${association.attributes.href}`
    );

    await page.goto(association.attributes.href);
    await page.waitForSelector(".sc-3lpl8o-5");

    const competitions = await page.$$eval(".sc-3lpl8o-5 > div", (elements) => {
      return elements.map((element) => {
        const competitionName =
          element.querySelector(".s41lvh-4")?.textContent.trim() ?? null;
        const season =
          element.querySelector(".s41lvh-5")?.textContent.trim() ?? null;
        const startDate =
          element.querySelector(".cUXLAP:nth-child(1)")?.textContent.trim() ?? null;
        const endDate =
          element.querySelector(".cUXLAP:nth-child(2)")?.textContent.trim() ?? null;
        const status = element.querySelector(".blmUXq")?.textContent.trim() ?? null;
        const url = element.querySelector("a")?.href ?? null;
        const competitionId = url ? url.split("/").slice(-1)[0] : null;

        return {
          competitionName,
          season,
          startDate,
          endDate,
          status,
          url,
          competitionId,
        };
      });
    });

    const assigner = new assignCompetitionsToAssociation();
    const result = await assigner.Setup(competitions, association.id);
    logger.info(`Has the Upload been completed? ${result.success}`);
  }

  async Setup() {
    const page = await this.browser.newPage();

    let pageNumber = 1;
    while (true) {
      const associations = await this.fetchAssociations(pageNumber);

      if (associations.length === 0) {
        logger.info("No more associations to process");
        break;
      }

      for (const association of associations) {
        try {
          await this.processAssociation(page, association);
        } catch (error) {
          logger.error(
            `Error processing association ${association.attributes.Name}:`,
            error
          );
          continue;
        }
      }

      pageNumber++;
    }

    await page.close();
  }

  dispose() {
    // Add any cleanup logic if necessary
  }
}

module.exports = getAssociationCompetitions;
