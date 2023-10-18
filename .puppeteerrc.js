/* const { join } = require('path');

let cacheDirectory;

if (process.env.NODE_ENV === 'production') {
  cacheDirectory = join(__dirname, '.cache', 'puppeteer');
}

module.exports = {
  cacheDirectory: cacheDirectory,
  // Add more options as needed.
};
 */
const { join } = require('path');

let config = {};

if (process.env.NODE_ENV === 'production') {
  config.cacheDirectory = join(__dirname, '.cache', 'puppeteer');
}

module.exports = config;