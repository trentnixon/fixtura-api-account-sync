const fetch = require("node-fetch");
const dotenv = require("dotenv");
const logger = require("./logger");

dotenv.config();

async function fetcher(PATH, method = "GET", body = {}, retry = true) {
  // Add fetcher options
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIXTURA_TOKEN}`,
    },
  };

  if (method === "POST" || method === "PUT") {
    options.body = JSON.stringify(body);
  }

  try {
    logger.info(`Fetching data from ${process.env.FIXTURA_API}${PATH}`);
    const response = await fetch(`${process.env.FIXTURA_API}${PATH}`, options);
    const res = await response.json();

    if (!response.ok) {
      console.log(res.error, method);
      console.log(res.error.details.errors);
      throw new Error(`Failed to fetch data from ${PATH}. Error: `);
    }

    logger.info(`Data fetched successfully from ${PATH}`);
    return res.data;
  } catch (error) {
    logger.error(`Error in fetcher: ${error}`);

    if (retry) {
      logger.info("Retrying fetcher in 2 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fetcher(PATH, method, body, false); // Retry without allowing more retries
    } else {
      return false;
    }
  }
}

module.exports = fetcher;
