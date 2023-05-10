const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const logger = require("./api/Utils/logger");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Class Stack
const getClubDetails = require("./api/Puppeteer/ClubDetails/index");
const getAssociationDetails = require("./api/Puppeteer/AssociationDetails/index");

// Utils
// Load the environment variables from the .env file
dotenv.config();
// Create a task queue with a concurrency limit

const app = express();
app.use(bodyParser.json());

// Log all requests and responses
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} request received`);
  res.on("finish", () => {
    logger.info(
      `${res.statusCode} ${res.statusMessage} sent in response to ${req.method} ${req.path} request`
    );
  });
  next();
});


app.get("/getClubDetails/:id", async (req, res) => {
  try {
    const clubDetails = new getClubDetails();
    const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); ;
    clubDetails.setBrowser(browser); // Pass the browser instance
    const result = await clubDetails.Setup(req.params.id);
    logger.info(`'* *************************************************** */`);
    logger.info(` Club Details has completed, for ID: ${req.params.id}`);
    logger.info(`'* *************************************************** */`);
    await browser.close();
    clubDetails.dispose();
    res.send(result);
  } catch (error) {
    logger.error(`Error getting Club Details: ${error}`);
    res.status(500).send("Error getting Club Details");
  }
});

app.get("/getAssociationDetails/:id", async (req, res) => {
  try {
    const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); ;
    const AssociationDetails = new getAssociationDetails();
    AssociationDetails.setBrowser(browser); // Pass the browser instance
    const result = await AssociationDetails.Setup(req.params.id);
    AssociationDetails.dispose();
    await browser.close();
    logger.info(
      `'* ******************************************************** */`
    );
    logger.info(` Association Details has completed, for ID: ${req.params.id}`);
    logger.info(
      `'* ******************************************************** */`
    );
    res.send(result);
  } catch (error) {
    logger.error(`Error getting Club Details: ${error}`);
    res.status(500).send("Error getting Club Details");
  }
});

(async () => {
  PQueue = (await import("p-queue")).default;
  queue = new PQueue({ concurrency: 1 });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
  });
})();