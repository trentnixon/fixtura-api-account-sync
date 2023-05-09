const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const logger = require("./api/Utils/logger");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// TEST
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







//const getAssociationsAndClubs = require("./api/Puppeteer/AssociationsAndClubs/getAssociationsAndClubs");
//const getRelationalAssociationForClubs = require("./api/Puppeteer/RelationalAssociationForClubs/getRelationalAssociationForClubs");
//const getAssociationCompetitions = require("./api/Puppeteer/AssociationCompetitions/getAssociationCompetitions");
//const getCompetitionGrades = require("./api/Puppeteer/CompetitionGrades/getCompetitionGrades");


/* app.get("/getAssociationsAndClubs/:path", async (req, res) => {
  try {
    const PATH = req.params.path;
    const result = await queue.add(async () => {
      const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); ;
      const scrap = new getAssociationsAndClubs(browser);
      const result = await scrap.Setup(PATH);
      await browser.close();
      return result;
    });
   
    res.send(result);
  } catch (error) {
    logger.error(`Error getting Associations and Clubs: ${error}`);
    res.status(500).send("Error getting Associations and Clubs");
  }
}); */

/* app.get("/getRelationalAssociationForClubs", async (req, res) => {
  const processor = new getRelationalAssociationForClubs();
  try {
    const result = await queue.add(async () => {
      const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); ;
      processor.setBrowser(browser);
      const data = await processor.Setup();
      await browser.close();
      return data;
    });
  
    res.send(result);
  } catch (error) {
    logger.error(`Error getting Relational Association for Clubs: ${error}`);
    res.status(500).send("Error getting Relational Association for Clubs");
  } finally {
    processor.dispose();
  }
}); */

/* app.get("/getAssociationCompetitions", async (req, res) => {
  try {
    const associationCompetitions = new getAssociationCompetitions();
    const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); ;
    associationCompetitions.setBrowser(browser);
    const result = await associationCompetitions.Setup();
  
    await browser.close();
    res.send(result);
    associationCompetitions.dispose();
  } catch (error) {
    logger.error(`Error getting Association Competitions: ${error}`);
    res.status(500).send("Error getting Association Competitions");
  }
}); */

/* app.get("/getCompetitionGrades", async (req, res) => {
  try {
    const competitionGrades = new getCompetitionGrades();
    const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); ;
    competitionGrades.setBrowser(browser); // Pass the browser instance to the class
    const result = await competitionGrades.Setup();
   
    await browser.close();
    res.send(result);
    competitionGrades.dispose();
  } catch (error) {
    logger.error(`Error getting Competition Grades: ${error}`);
    res.status(500).send("Error getting Competition Grades");
  }
}); */