const logger = require("../../../src/utils/logger");
const PuppeteerManager = require("../../puppeteer/PuppeteerManager");
const AssociationCompetitionsFetcher = require("./AssociationCompetitionsFetcher");
const CRUDOperations = require("../../services/CRUDoperations");
const ProcessingTracker = require("../../services/processingTracker");
const { processInParallel } = require("../../utils/parallelUtils");
const { PARALLEL_CONFIG } = require("../../puppeteer/constants");
const OperationContext = require("../../utils/OperationContext");

/**
 * Handles scraping of competition data from websites.
 * Supports different modes for clubs and associations.
 */
class GetCompetitions {
  constructor(TYPEOBJ, ACCOUNT, ProcessTracker) {
    this.AccountID = TYPEOBJ.TYPEID;
    this.URL = TYPEOBJ.TYPEURL;
    this.ACCOUNTTYPE = ACCOUNT.ACCOUNTTYPE;
    this.processingTracker = ProcessingTracker.getInstance();
    // Use singleton to share browser instance across services (memory optimization)
    this.puppeteerManager = PuppeteerManager.getInstance();
    this.CRUDOperations = new CRUDOperations();
  }

  // Initialize Puppeteer and get a reusable page (Strategy 2: Page Reuse)
  async initPage() {
    return await this.puppeteerManager.getReusablePage();
  }

  // Fetch competitions for associations
  async fetchAssociationCompetitions(page, url, associationID) {
    const fetcher = new AssociationCompetitionsFetcher(
      page,
      url,
      associationID
    );
    return fetcher.fetchCompetitions();
  }

  // OPTIMIZED PARALLEL PROCESSING: Process multiple associations concurrently using page pool
  // Uses same pattern as Teams/Games/Validation stages for consistency and performance
  async processClubCompetitions() {
    const context = new OperationContext(
      "processClubCompetitions",
      "competitions",
      {
        accountID: this.AccountID,
        accountType: this.ACCOUNTTYPE,
      }
    );

    // Check account type and use the appropriate CRUD method
    let associationData;
    if (this.ACCOUNTTYPE === "ASSOCIATION") {
      // For associations, fetch association data
      associationData = await this.CRUDOperations.fetchDataForAssociation(
        this.AccountID
      );
      // For associations, we process the association itself (not its clubs)
      // This method is designed for clubs with multiple associations, so for associations
      // we should treat it as a single association to process
      const associations = [associationData];
      return await this.processAssociationsList(associations);
    } else {
      // CLUB account type - fetch club and get its associations
      associationData = await this.CRUDOperations.fetchDataForClub(
        this.AccountID
      );
    }
    const associations = associationData.attributes.associations.data;

    if (associations.length === 0) {
      context.log("No associations found");
      return [];
    }

    context.log(`Processing ${associations.length} associations`, {
      associationsCount: associations.length,
    });

    const concurrency = PARALLEL_CONFIG.COMPETITIONS_CONCURRENCY;
    logger.info(
      `[PARALLEL] Processing ${associations.length} associations with concurrency=${concurrency}`
    );

    // CRITICAL: Create page pool ONCE before processing
    // Use concurrency (not PAGE_POOL_SIZE) - we only need 2 pages for competitions
    // PAGE_POOL_SIZE is for other stages that need more
    if (this.puppeteerManager.pagePool.length === 0) {
      logger.info(
        `[PARALLEL] Creating page pool of size ${concurrency} for competitions stage`
      );
      await this.puppeteerManager.createPagePool(concurrency);
    } else {
      logger.info(
        `[PARALLEL] Page pool already exists (${this.puppeteerManager.pagePool.length} pages), reusing`
      );
    }

    // Use processInParallel utility (consistent with other stages)
    // This provides better error handling, logging, and concurrency control
    const { results, errors, summary } = await processInParallel(
      associations,
      async (association, index) => {
        const taskStartTime = Date.now();
        // Get a page from the pool (waits if none available)
        const page = await this.puppeteerManager.getPageFromPool();
        const pageAcquiredTime = Date.now();

        try {
          logger.info(
            `[PARALLEL_COMPETITIONS] [TASK-${index + 1}] START association: ${
              association.attributes.href || association.id
            } (page acquired: ${pageAcquiredTime - taskStartTime}ms)`
          );

          const comp = await this.fetchAssociationCompetitions(
            page,
            association.attributes.href,
            association.id
          );

          const taskDuration = Date.now() - taskStartTime;
          logger.info(
            `[PARALLEL_COMPETITIONS] [TASK-${
              index + 1
            }] COMPLETE association: ${
              association.attributes.href || association.id
            } (duration: ${taskDuration}ms, competitions: ${comp?.length || 0})`
          );

          return comp || [];
        } catch (error) {
          logger.error(
            `[PARALLEL] Error processing association ${association.id}: ${error.message}`,
            {
              error: error.message,
              associationId: association.id,
              index,
            }
          );
          throw error; // Re-throw to be caught by processInParallel
        } finally {
          // Release page back to pool for reuse (don't close it)
          await this.puppeteerManager.releasePageFromPool(page);
        }
      },
      concurrency,
      {
        context: "competitions",
        logProgress: true,
        continueOnError: true,
      }
    );

    context.log("Competitions processing completed", {
      total: associations.length,
      successful: summary.successful,
      failed: summary.failed,
      duration: summary.duration,
    });

    if (errors.length > 0) {
      context.warn("Some associations failed to process", {
        failedCount: errors.length,
        errors: errors.map((e) => ({
          associationId: e.item?.id,
          error: e.error,
        })),
      });
    }

    return results.filter((comp) => comp !== null).flat();
  }

  // Helper method to process a list of associations
  // NOTE: Does NOT create page pool - assumes pool already created by caller
  async processAssociationsList(associations) {
    if (associations.length === 0) {
      return [];
    }

    const concurrency = PARALLEL_CONFIG.COMPETITIONS_CONCURRENCY;
    logger.info(
      `[PARALLEL] Processing ${associations.length} associations with concurrency=${concurrency}`
    );

    // Pool should already be created by processClubCompetitions() - just verify
    if (this.puppeteerManager.pagePool.length === 0) {
      logger.warn(
        `[PARALLEL] WARNING: Page pool is empty! This should not happen. Creating pool now.`
      );
      await this.puppeteerManager.createPagePool(concurrency);
    } else {
      logger.debug(
        `[PARALLEL] Using existing page pool (${this.puppeteerManager.pagePool.length} pages)`
      );
    }

    const { results, errors, summary } = await processInParallel(
      associations,
      async (association, index) => {
        const taskStartTime = Date.now();
        const page = await this.puppeteerManager.getPageFromPool();
        const pageAcquiredTime = Date.now();
        try {
          logger.info(
            `[PARALLEL_COMPETITIONS] [TASK-${index + 1}] START association: ${
              association.attributes?.href || association.id
            } (page acquired: ${pageAcquiredTime - taskStartTime}ms)`
          );

          const comp = await this.fetchAssociationCompetitions(
            page,
            association.attributes?.href || this.URL,
            association.id
          );

          const taskDuration = Date.now() - taskStartTime;
          logger.info(
            `[PARALLEL_COMPETITIONS] [TASK-${
              index + 1
            }] COMPLETE association: ${
              association.attributes?.href || association.id
            } (duration: ${taskDuration}ms, competitions: ${comp?.length || 0})`
          );

          return comp || [];
        } catch (error) {
          logger.error(
            `[PARALLEL] Error processing association ${association.id}: ${error.message}`,
            {
              error: error.message,
              associationId: association.id,
              index,
            }
          );
          throw error;
        } finally {
          await this.puppeteerManager.releasePageFromPool(page);
        }
      },
      concurrency,
      {
        context: "competitions",
        logProgress: true,
        continueOnError: true,
      }
    );

    if (errors.length > 0) {
      logger.warn("Some associations failed to process", {
        failedCount: errors.length,
        errors: errors.map((e) => ({
          associationId: e.item?.id,
          error: e.error,
        })),
      });
    }

    return results.filter((comp) => comp !== null).flat();
  }

  // Main method to setup competition scraping
  async setup() {
    try {
      // DEBUG: Add test mode to force parallel processing
      const FORCE_PARALLEL = process.env.FORCE_PARALLEL_COMPETITIONS === "true";

      // If we have multiple associations (fetched inside processClubCompetitions), process in parallel
      // For now, we'll assume single association unless FORCE_PARALLEL is true
      // The previous logic was fetching associations here which caused 404s

      let associations = [];
      if (FORCE_PARALLEL) {
        logger.warn(
          `[GetCompetitions] FORCE_PARALLEL mode: Creating fake associations for testing`
        );
        // Create fake associations from the single URL for testing
        associations = [
          { id: this.AccountID, attributes: { href: this.URL } },
          { id: this.AccountID, attributes: { href: this.URL } },
          { id: this.AccountID, attributes: { href: this.URL } },
        ];
      } else {
        // Try to fetch associations to see if we should run in parallel
        // Check account type and use the appropriate CRUD method
        try {
          let associationData;
          if (this.ACCOUNTTYPE === "ASSOCIATION") {
            // For associations, fetch the association data
            associationData = await this.CRUDOperations.fetchDataForAssociation(
              this.AccountID
            );
            // For associations, check if there are clubs to process
            associations = associationData?.attributes?.clubs?.data || [];
          } else {
            // For clubs, fetch club data and get its associations
            associationData = await this.CRUDOperations.fetchDataForClub(
              this.AccountID
            );
            associations =
              associationData?.attributes?.associations?.data || [];
          }
        } catch (e) {
          // Ignore errors here - likely just means no associations/clubs found or wrong endpoint for this account type
          // We'll fall back to single processing
          logger.debug(
            `[GetCompetitions] Could not fetch data for parallel check: ${e.message}`
          );
        }
      }

      // If we have multiple associations, process in parallel
      if (associations.length > 1) {
        logger.info(
          `[GetCompetitions] Processing ${associations.length} associations in PARALLEL`
        );
        const competitions = await this.processClubCompetitions();
        this.processingTracker.itemFound("competitions", competitions.length);
        return competitions;
      } else {
        // Single association - process normally
        logger.info(
          `[GetCompetitions] Processing single association (ID: ${this.AccountID}) - NO PARALLEL`
        );
        logger.info(`[GetCompetitions] URL to scrape: ${this.URL}`);
        logger.info(`[GetCompetitions] Initializing page...`);

        let page = null;
        try {
          page = await this.initPage();
          logger.info(`[GetCompetitions] Page initialized successfully`);

          logger.info(
            `[GetCompetitions] Fetching competitions from URL: ${this.URL}`
          );
          const competitions = await this.fetchAssociationCompetitions(
            page,
            this.URL,
            this.AccountID
          );

          logger.info(
            `[GetCompetitions] Fetched ${
              competitions ? competitions.length : 0
            } competitions`,
            {
              competitionsCount: competitions ? competitions.length : 0,
              competitions: competitions,
            }
          );

          this.processingTracker.itemFound(
            "competitions",
            competitions ? competitions.length : 0
          );
          return competitions || [];
        } catch (innerError) {
          logger.error(
            "[GetCompetitions] Error in single association processing",
            {
              error: innerError.message,
              errorName: innerError.name,
              accountId: this.AccountID,
              url: this.URL,
              stack: innerError.stack,
              pageExists: !!page,
              pageClosed: page ? page.isClosed() : null,
            }
          );
          throw innerError; // Re-throw to be caught by outer catch
        } finally {
          if (page) {
            logger.info(`[GetCompetitions] Releasing page back to pool`);
            try {
              await this.puppeteerManager.releasePageToPool(page);
            } catch (releaseError) {
              logger.error("[GetCompetitions] Error releasing page", {
                error: releaseError.message,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error("[GetCompetitions] Error in GetCompetitions setup", {
        error: error.message,
        errorName: error.name,
        accountId: this.AccountID,
        url: this.URL,
        stack: error.stack,
        errorString: String(error),
        errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      return [];
    }
  }
}

module.exports = GetCompetitions;
