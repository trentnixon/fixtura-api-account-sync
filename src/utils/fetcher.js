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

    // Handle DELETE requests that may return 204 No Content or empty response
    if (method === "DELETE") {
      // For DELETE requests, handle empty responses gracefully
      if (response.status === 204) {
        // 204 No Content - successful deletion with no response body
        logger.info(
          `[DELETE] Data deleted successfully from ${PATH} (status: 204 No Content)`
        );
        return { deleted: true, status: 204 };
      }

      if (response.ok && response.status === 200) {
        // 200 OK - check if there's a response body
        try {
          const responseText = await response.text();
          if (responseText) {
            const res = JSON.parse(responseText);
            logger.info(
              `[DELETE] Data deleted successfully from ${PATH} (status: 200)`
            );
            return res.data || { deleted: true, status: 200 };
          }
          logger.info(
            `[DELETE] Data deleted successfully from ${PATH} (status: 200, empty response)`
          );
          return { deleted: true, status: 200 };
        } catch (parseError) {
          // Empty response is fine for DELETE
          logger.info(
            `[DELETE] Data deleted successfully from ${PATH} (status: 200)`
          );
          return { deleted: true, status: 200 };
        }
      }

      // For error responses, try to parse JSON error message
      if (!response.ok) {
        try {
          const responseText = await response.text();
          if (responseText) {
            try {
              const res = JSON.parse(responseText);
              const errorDetail = res.error
                ? JSON.stringify(res.error)
                : res.message || "Unknown error";
              throw new Error(
                `[fetcher.js] Failed to delete data from ${PATH}. Status: ${response.status}, Error: ${errorDetail}`
              );
            } catch (parseError) {
              // Not JSON, use text as error message
              throw new Error(
                `[fetcher.js] Failed to delete data from ${PATH}. Status: ${response.status}, Error: ${responseText}`
              );
            }
          } else {
            // Empty response but error status
            throw new Error(
              `[fetcher.js] Failed to delete data from ${PATH}. Status: ${response.status}`
            );
          }
        } catch (error) {
          // Re-throw if it's already an Error, otherwise wrap it
          if (error instanceof Error) {
            throw error;
          }
          throw new Error(
            `[fetcher.js] Failed to delete data from ${PATH}. Status: ${response.status}, Error: ${error}`
          );
        }
      }
    }

    // For other methods (GET, POST, PUT), parse JSON response
    const responseText = await response.text();
    if (!responseText && (method === "POST" || method === "PUT")) {
      // POST/PUT might have empty responses, but GET should have data
      if (response.ok) {
        logger.info(
          `Data ${
            method === "POST" ? "created" : "updated"
          } successfully from ${PATH} (empty response)`
        );
        return { success: true, status: response.status };
      }
    }

    if (!responseText) {
      throw new Error(
        `[fetcher.js] Empty response from ${PATH}. Status: ${response.status}`
      );
    }

    const res = JSON.parse(responseText);

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
