const fetch = require("node-fetch");
const dotenv = require("dotenv");
const logger = require("./logger");
const { API_CONFIG } = require("../config/environment");

dotenv.config();

async function fetcher(PATH, method = "GET", body = {}, retryCount = null) {
  // Use configured retry count if not specified
  if (retryCount === null) {
    retryCount = API_CONFIG.retryAttempts;
  }

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_CONFIG.token}`,
    },
  };

  if (method === "POST" || method === "PUT") {
    options.body = JSON.stringify(body);
  }

  try {
    const fullUrl = `${API_CONFIG.baseUrl}${PATH}`;

    logger.info(`Fetching data from ${fullUrl}`);

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
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
    // Handle specific error types
    if (error.name === "AbortError") {
      logger.error(
        `[fetcher.js] Request timeout after ${API_CONFIG.timeout}ms for ${PATH}`,
        {
          file: "fetcher.js",
          function: "fetcher",
          path: PATH,
          method: method,
          timeout: API_CONFIG.timeout,
        }
      );
    } else if (error.code === "ECONNREFUSED") {
      logger.error(
        `[fetcher.js] Connection refused to API server. Please ensure the server is running.`,
        {
          file: "fetcher.js",
          function: "fetcher",
          error: error.message,
          path: PATH,
          method: method,
          apiUrl: API_CONFIG.baseUrl,
        }
      );
    } else {
      logger.error(`[fetcher.js] Error in fetcher: ${error}`);
    }

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
      logger.info(
        `[fetcher.js] Retrying fetcher in 5 seconds... (${retryCount} attempts remaining)`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetcher(PATH, method, body, retryCount - 1);
    } else {
      logger.error(`[fetcher.js] All retry attempts exhausted for ${PATH}`);
      return null;
    }
  }
}

module.exports = fetcher;
