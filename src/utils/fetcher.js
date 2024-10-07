const fetch = require("node-fetch");
const dotenv = require("dotenv");
const logger = require("./logger");

dotenv.config();

async function fetcher(PATH, method = "GET", body = {}, retryCount = 2) {
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
      const errorDetail = res.error
        ? JSON.stringify(res.error)
        : "Unknown error";
      throw new Error(
        `[fetcher.js] Failed to fetch data from ${PATH}. Status: ${response.status}, Error: ${errorDetail}`
      );
    }

    logger.info(`Data fetched successfully from ${PATH}`);
    return res.data;
  } catch (error) {
    logger.error(`[fetcher.js] Error in fetcher: ${error}`);
    logger.critical("[fetcher.js] An error occurred in fetcher", {
      file: "fetcher.js",
      function: "fetcher",
      error: error,
      path: PATH,
      method: method,
      body: body,
      retryCount: retryCount,
    });

    if (retryCount > 0) {
      logger.info("[fetcher.js] Retrying fetcher in 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      return fetcher(PATH, method, body, retryCount - 1);
    } else {
      return null;
    }
  }
}

module.exports = fetcher;
