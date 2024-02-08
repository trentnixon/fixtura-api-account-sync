const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error) {
    throw new Error("[environment.js] Failed to load '.env' file: " + result.error);
}

const ENVIRONMENT = (process.env.NODE_ENV || '').trim();

if (!ENVIRONMENT) {
    throw new Error("[environment.js] NODE_ENV is not set. Please set NODE_ENV to 'development' or 'production'.");
}

module.exports = { ENVIRONMENT };
