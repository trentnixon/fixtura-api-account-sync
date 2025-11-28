/**
 * Page Utilities
 * Helper functions for page management
 */

const logger = require("../../src/utils/logger");

/**
 * Close a single page safely
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} True if page was closed successfully
 */
const closePageSafely = async (page) => {
  if (!page) return false;

  try {
    if (!page.isClosed()) {
      await page.close();
      return true;
    }
    return false;
  } catch (error) {
    logger.debug("Error closing page (may already be closed)", {
      error: error.message,
    });
    return false;
  }
};

/**
 * Close multiple pages safely
 * @param {Page[]} pages - Array of Puppeteer page objects
 * @returns {Promise<number>} Number of pages closed successfully
 */
const closePagesSafely = async (pages) => {
  if (!pages || pages.length === 0) return 0;

  const results = await Promise.allSettled(
    pages.map((page) => closePageSafely(page))
  );

  return results.filter(
    (result) => result.status === "fulfilled" && result.value
  ).length;
};

/**
 * Get all pages from browser safely
 * @param {Browser} browser - Puppeteer browser object
 * @returns {Promise<Page[]>} Array of pages
 */
const getPagesSafely = async (browser) => {
  if (!browser) return [];

  try {
    return await browser.pages();
  } catch (error) {
    logger.debug("Error getting pages from browser", { error: error.message });
    return [];
  }
};

module.exports = {
  closePageSafely,
  closePagesSafely,
  getPagesSafely,
};
