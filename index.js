/** 
 * SOLID APPROVED  
 * DO NOT ADJUST UNLESS ERROR IN CODE
*/


/*
AI PROMPT

Lets Refactor the following class, function, or component, adhere to SOLID principles, robust error handling, and efficient management of large and long-term memory storage for maintainability, scalability, and seamless integration within the system.

*/

// server.js
const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const logger = require("./api/Utils/logger");
const ClubDetailsController = require("./api/Puppeteer/ClubDetails/ClubDetailsController");
const AssociationDetailsController = require("./api/Puppeteer/AssociationDetails/AssociationDetailsController");

dotenv.config();

const app = express();
app.use(bodyParser.json());

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
    const clubController = new ClubDetailsController();
    await clubController.setup(req.params.id);
    const result = await clubController.run(req.params.id); 
    await clubController.dispose();
    console.log("CLUB SYNC UPDATE COMPLETE")
    res.send(result);
  } catch (error) {
    logger.error(`Error getting Club Details: ${error}`);
    res.status(500).send("Error getting Club Details");
  }
});

app.get("/getAssociationDetails/:id", async (req, res) => {
  try {
    const associationController = new AssociationDetailsController();
    const result = await associationController.setup(req.params.id);
    await associationController.dispose();
    console.log("ASSOCIATION SYNC UPDATE COMPLETE")
    res.send(result);
  } catch (error) {
    logger.error(`Error getting Association Details: ${error}`);
    res.status(500).send("Error getting Association Details");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
