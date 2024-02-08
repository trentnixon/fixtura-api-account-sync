const dotenv = require("dotenv");
const result = dotenv.config();

const ENVIRONMENT = (process.env.NODE_ENV || "").trim();

if (!ENVIRONMENT) {
  if (result.error) {
    console.log(result.error);
    throw new Error(
      "[environment.js] Failed to load '.env' file: " + result.error
    );
  }
  throw new Error(
    "[environment.js] NODE_ENV is not set. Please set NODE_ENV to 'development' or 'production'."
  );
}

module.exports = { ENVIRONMENT };
