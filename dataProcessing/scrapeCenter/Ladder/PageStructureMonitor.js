const logger = require("../../../src/utils/logger");

/**
 * PageStructureMonitor class monitors for changes in PlayHQ page structure
 * and alerts when investigation is needed
 */
class PageStructureMonitor {
  constructor(page) {
    this.page = page;

    // Define the critical selectors we depend on
    this.criticalSelectors = {
      // Ladder container - essential for finding teams
      ladderContainer: '[data-testid="ladder"]',

      // Standard table structure - where teams are displayed
      // Structure: [data-testid="ladder"] > div > table > tbody > tr > td:nth-child(2) > a
      ladderTable: "table",
      firstTable: "table:first-of-type",
      tableBody: "tbody",
      tableRows: "tr",
      teamColumn: "td:nth-child(2)",
      teamLinks: 'a[href*="/teams/"]',

      // Standard team selector - the reliable pattern we discovered
      standardTeamSelector:
        '[data-testid="ladder"] table:first-of-type tbody tr td:nth-child(2) a',

      // No ladder message - for competitions without ladders
      noLadderMessage: ".sc-cPiKLX",

      // Alternative selectors for monitoring
      alternativeSelectors: {
        ladderByClass: '[class*="ladder"]',
        ladderById: '[id*="ladder"]',
        teamLinksAlt: 'a[href*="/team/"]',
        anyTableTeams:
          '[data-testid="ladder"] table tbody tr td a[href*="/teams/"]',
      },
    };

    // Store baseline structure for comparison
    this.baselineStructure = null;
  }

  /**
   * Analyzes current page structure and stores as baseline
   * @returns {Promise<Object>} Current page structure analysis
   */
  async establishBaseline() {
    try {
      const structure = await this.analyzePageStructure();
      this.baselineStructure = structure;
      logger.info("Page structure baseline established");
      return structure;
    } catch (error) {
      logger.warn(
        "Could not establish page structure baseline:",
        error.message
      );
      return null;
    }
  }

  /**
   * Analyzes current page structure
   * @returns {Promise<Object>} Page structure analysis
   */
  async analyzePageStructure() {
    try {
      const structure = {
        timestamp: new Date().toISOString(),
        url: this.page.url(),
        title: await this.page.title(),

        // Critical elements
        criticalElements: {},

        // Alternative elements
        alternativeElements: {},

        // Page metadata
        pageMetadata: {},
      };

      // Check critical selectors
      for (const [name, selector] of Object.entries(this.criticalSelectors)) {
        if (typeof selector === "string") {
          structure.criticalElements[name] = await this.checkSelector(selector);
        }
      }

      // Check alternative selectors
      for (const [name, selector] of Object.entries(
        this.criticalSelectors.alternativeSelectors
      )) {
        structure.alternativeElements[name] = await this.checkSelector(
          selector
        );
      }

      // Get page metadata
      structure.pageMetadata = await this.getPageMetadata();

      return structure;
    } catch (error) {
      logger.warn("Could not analyze page structure:", error.message);
      return {};
    }
  }

  /**
   * Checks if a selector exists and returns details
   * @param {string} selector - CSS selector to check
   * @returns {Promise<Object>} Selector check result
   */
  async checkSelector(selector) {
    try {
      const elements = await this.page.$$(selector);
      const exists = elements.length > 0;

      let details = null;
      if (exists && elements.length > 0) {
        details = await this.getElementDetails(elements[0], selector);
      }

      return {
        exists,
        count: elements.length,
        details,
      };
    } catch (error) {
      return {
        exists: false,
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Gets detailed information about an element
   * @param {Element} element - Puppeteer element
   * @param {string} selector - Original selector used
   * @returns {Promise<Object>} Element details
   */
  async getElementDetails(element, selector) {
    try {
      return await this.page.evaluate(
        (el, sel) => {
          return {
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            dataTestId: el.getAttribute("data-testid"),
            ariaLabel: el.getAttribute("aria-label"),
            role: el.getAttribute("role"),
            childElementCount: el.children.length,
            hasChildren: el.children.length > 0,
            selector: sel,
          };
        },
        element,
        selector
      );
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Gets page metadata for structure analysis
   * @returns {Promise<Object>} Page metadata
   */
  async getPageMetadata() {
    try {
      return await this.page.evaluate(() => {
        return {
          hasTables: document.querySelectorAll("table").length > 0,
          tableCount: document.querySelectorAll("table").length,
          hasLadderText: document.body.innerText.includes("Ladder"),
          hasTeamText: document.body.innerText.includes("Team"),
          hasPositionText: document.body.innerText.includes("Position"),
          totalLinks: document.querySelectorAll("a").length,
          teamLinks: document.querySelectorAll('a[href*="/teams/"]').length,
          teamLinksAlt: document.querySelectorAll('a[href*="/team/"]').length,
        };
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Compares current structure with baseline and detects changes
   * @returns {Promise<Object>} Structure change analysis
   */
  async detectStructureChanges() {
    if (!this.baselineStructure) {
      logger.warn("No baseline structure established - cannot detect changes");
      return { hasChanges: false, changes: [] };
    }

    try {
      const currentStructure = await this.analyzePageStructure();
      const changes = this.compareStructures(
        this.baselineStructure,
        currentStructure
      );

      if (changes.length > 0) {
        this.alertStructureChanges(changes, currentStructure);
      }

      return {
        hasChanges: changes.length > 0,
        changes,
        currentStructure,
      };
    } catch (error) {
      logger.warn("Could not detect structure changes:", error.message);
      return { hasChanges: false, changes: [], error: error.message };
    }
  }

  /**
   * Compares two page structures and identifies changes
   * @param {Object} baseline - Baseline structure
   * @param {Object} current - Current structure
   * @returns {Array} Array of detected changes
   */
  compareStructures(baseline, current) {
    const changes = [];

    // Compare critical elements
    for (const [name, baselineElement] of Object.entries(
      baseline.criticalElements || {}
    )) {
      const currentElement = current.criticalElements?.[name];

      if (!currentElement) {
        changes.push({
          type: "CRITICAL_ELEMENT_MISSING",
          element: name,
          severity: "HIGH",
          message: `Critical element '${name}' is completely missing from current page`,
        });
        continue;
      }

      // Check if element still exists
      if (baselineElement.exists && !currentElement.exists) {
        changes.push({
          type: "CRITICAL_ELEMENT_DISAPPEARED",
          element: name,
          severity: "HIGH",
          message: `Critical element '${name}' no longer exists (was found ${baselineElement.count} times, now 0)`,
        });
      }

      // Check count changes
      if (baselineElement.count !== currentElement.count) {
        changes.push({
          type: "ELEMENT_COUNT_CHANGED",
          element: name,
          severity: "MEDIUM",
          message: `Element '${name}' count changed from ${baselineElement.count} to ${currentElement.count}`,
          baseline: baselineElement.count,
          current: currentElement.count,
        });
      }

      // Check element details changes
      if (baselineElement.details && currentElement.details) {
        const detailChanges = this.compareElementDetails(
          baselineElement.details,
          currentElement.details,
          name
        );
        changes.push(...detailChanges);
      }
    }

    // Compare page metadata
    if (baseline.pageMetadata && current.pageMetadata) {
      for (const [key, baselineValue] of Object.entries(
        baseline.pageMetadata
      )) {
        const currentValue = current.pageMetadata[key];
        if (baselineValue !== currentValue) {
          changes.push({
            type: "PAGE_METADATA_CHANGED",
            element: key,
            severity: "LOW",
            message: `Page metadata '${key}' changed from ${baselineValue} to ${currentValue}`,
            baseline: baselineValue,
            current: currentValue,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Compares element details for changes
   * @param {Object} baseline - Baseline element details
   * @param {Object} current - Current element details
   * @param {string} elementName - Name of the element being compared
   * @returns {Array} Array of detail changes
   */
  compareElementDetails(baseline, current, elementName) {
    const changes = [];
    const criticalAttributes = ["className", "dataTestId", "id"];

    for (const attr of criticalAttributes) {
      if (baseline[attr] !== current[attr]) {
        changes.push({
          type: "ELEMENT_ATTRIBUTE_CHANGED",
          element: elementName,
          attribute: attr,
          severity: "HIGH",
          message: `Element '${elementName}' ${attr} changed from '${baseline[attr]}' to '${current[attr]}'`,
          baseline: baseline[attr],
          current: current[attr],
        });
      }
    }

    return changes;
  }

  /**
   * Alerts about structure changes that need investigation
   * @param {Array} changes - Array of detected changes
   * @param {Object} currentStructure - Current page structure
   */
  alertStructureChanges(changes, currentStructure) {
    const highSeverityChanges = changes.filter((c) => c.severity === "HIGH");
    const mediumSeverityChanges = changes.filter(
      (c) => c.severity === "MEDIUM"
    );

    logger.error(
      "🚨 PAGE STRUCTURE CHANGES DETECTED - INVESTIGATION REQUIRED 🚨"
    );
    logger.error(`URL: ${currentStructure.url}`);
    logger.error(`Title: ${currentStructure.title}`);
    logger.error(`Total Changes: ${changes.length}`);
    logger.error(`High Severity: ${highSeverityChanges.length}`);
    logger.error(`Medium Severity: ${mediumSeverityChanges.length}`);

    if (highSeverityChanges.length > 0) {
      logger.error("🔴 HIGH PRIORITY CHANGES (IMMEDIATE ACTION REQUIRED):");
      highSeverityChanges.forEach((change) => {
        logger.error(`  - ${change.message}`);
      });
    }

    if (mediumSeverityChanges.length > 0) {
      logger.error("🟡 MEDIUM PRIORITY CHANGES (INVESTIGATE SOON):");
      mediumSeverityChanges.forEach((change) => {
        logger.error(`  - ${change.message}`);
      });
    }

    logger.error("📋 INVESTIGATION REQUIRED:");
    logger.error("  1. Check if PlayHQ has updated their website");
    logger.error("  2. Verify if our selectors still work");
    logger.error("  3. Update selectors if necessary");
    logger.error("  4. Test with multiple competitions");
    logger.error("  5. Update baseline structure after fixes");

    // Log detailed change information for debugging
    logger.error("📊 DETAILED CHANGE LOG:");
    changes.forEach((change, index) => {
      logger.error(`  Change ${index + 1}:`);
      logger.error(`    Type: ${change.type}`);
      logger.error(`    Element: ${change.element}`);
      logger.error(`    Severity: ${change.severity}`);
      logger.error(`    Message: ${change.message}`);
      if (change.baseline !== undefined) {
        logger.error(`    Baseline: ${change.baseline}`);
      }
      if (change.current !== undefined) {
        logger.error(`    Current: ${change.current}`);
      }
      logger.error("    ---");
    });
  }

  /**
   * Gets a summary of current page structure health
   * @returns {Promise<Object>} Structure health summary
   */
  async getStructureHealth() {
    try {
      const structure = await this.analyzePageStructure();
      const criticalElements = Object.values(structure.criticalElements || {});

      const health = {
        overall: "HEALTHY",
        criticalElements: {
          total: criticalElements.length,
          working: criticalElements.filter((el) => el.exists).length,
          broken: criticalElements.filter((el) => !el.exists).length,
        },
        recommendations: [],
      };

      // Determine overall health
      const brokenCritical = health.criticalElements.broken;
      if (brokenCritical === 0) {
        health.overall = "HEALTHY";
      } else if (brokenCritical <= 2) {
        health.overall = "DEGRADED";
        health.recommendations.push(
          "Some critical elements are missing - monitor closely"
        );
      } else {
        health.overall = "CRITICAL";
        health.recommendations.push(
          "Multiple critical elements missing - immediate investigation required"
        );
      }

      return health;
    } catch (error) {
      logger.warn("Could not get structure health:", error.message);
      return { overall: "UNKNOWN", error: error.message };
    }
  }
}

module.exports = PageStructureMonitor;
