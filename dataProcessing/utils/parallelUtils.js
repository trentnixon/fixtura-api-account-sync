/**
 * Parallel Processing Utilities
 * Strategy 1: Parallel Page Processing
 *
 * Provides utilities for processing items in parallel with concurrency control.
 * Uses p-limit to manage concurrent operations and prevent resource exhaustion.
 */

// p-limit v3 supports CommonJS require (v4+ is ESM-only)
const pLimit = require("p-limit");
const logger = require("../../src/utils/logger");

/**
 * Process items in parallel with controlled concurrency
 *
 * This function processes an array of items concurrently, but limits the number
 * of concurrent operations to prevent resource exhaustion (memory, network, etc.).
 *
 * Individual item failures are logged but don't stop processing of other items.
 * All results (successful and failed) are returned with error information.
 *
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Async function that processes a single item: (item, index) => Promise<result>
 * @param {number} concurrency - Maximum number of concurrent operations (default: 3)
 * @param {Object} options - Additional options
 * @param {boolean} options.continueOnError - Continue processing if individual items fail (default: true)
 * @param {boolean} options.logProgress - Log progress for each item (default: false)
 * @param {string} options.context - Context name for logging (default: "parallel")
 * @param {boolean} options.streamResults - Stream results instead of accumulating (default: false)
 * @param {Function} options.onResult - Callback for each result when streaming: (result, index, item) => Promise<void>
 * @returns {Promise<{results: Array, errors: Array, summary: Object}>} Object containing results, errors, and summary
 *
 * @example
 * const items = [1, 2, 3, 4, 5];
 * const processor = async (item) => {
 *   // Process item
 *   return item * 2;
 * };
 *
 * const { results, errors, summary } = await processInParallel(items, processor, 3);
 * // results: [2, 4, 6, 8, 10]
 * // errors: []
 * // summary: { total: 5, successful: 5, failed: 0 }
 */
async function processInParallel(
  items,
  processor,
  concurrency = 3,
  options = {}
) {
  const {
    continueOnError = true,
    logProgress = false,
    context = "parallel",
    streamResults = false, // MEMORY FIX: Stream results instead of accumulating
    onResult = null, // MEMORY FIX: Callback for each result when streaming
  } = options;

  if (!Array.isArray(items)) {
    throw new Error("Items must be an array");
  }

  if (typeof processor !== "function") {
    throw new Error("Processor must be a function");
  }

  if (items.length === 0) {
    logger.debug(`[${context}] No items to process`);
    return {
      results: [],
      errors: [],
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        duration: 0,
      },
    };
  }

  const startTime = Date.now();
  const limit = pLimit(concurrency);
  const results = [];
  const errors = [];
  let activeCount = 0; // Track how many are currently running

  logger.info(
    `[${context}] Starting parallel processing: ${items.length} items, concurrency: ${concurrency}`
  );

  // Create promises for all items with concurrency limit
  // All promises are created immediately, but p-limit controls how many run concurrently
  const promises = items.map((item, index) =>
    limit(async () => {
      const itemStartTime = Date.now();
      activeCount++;
      const currentActive = activeCount;

      try {
        logger.info(
          `[${context}] START processing item ${index + 1}/${
            items.length
          } (concurrency: ${concurrency}, currently active: ${currentActive})`
        );

        const result = await processor(item, index);

        const itemDuration = Date.now() - itemStartTime;
        activeCount--;
        logger.info(
          `[${context}] COMPLETE item ${index + 1}/${
            items.length
          } in ${itemDuration}ms (remaining active: ${activeCount})`
        );

        // MEMORY FIX: Stream result immediately if streaming enabled
        if (streamResults && onResult && typeof onResult === "function") {
          try {
            // Process result immediately, don't accumulate
            await onResult(result, index, item);
            // Still track for summary, but don't store full result
            results.push({ item, index, result: null, success: true }); // Store null to save memory
          } catch (streamError) {
            logger.error(
              `[${context}] Error in onResult callback for item ${index + 1}`,
              {
                error: streamError.message,
                index,
              }
            );
            // Still mark as successful for summary, but log the stream error
            results.push({ item, index, result: null, success: true });
          }
        } else {
          // Otherwise accumulate (backward compatibility)
          results.push({ item, index, result, success: true });
        }
        return { item, index, result, success: true };
      } catch (error) {
        const errorInfo = {
          item,
          index,
          error: error.message,
          stack: error.stack,
          success: false,
        };

        errors.push(errorInfo);
        results.push(errorInfo);
        activeCount--;

        logger.error(
          `[${context}] Error processing item ${index + 1}/${
            items.length
          } (remaining active: ${activeCount})`,
          {
            item: typeof item === "object" ? JSON.stringify(item) : item,
            error: error.message,
            index,
          }
        );

        if (!continueOnError) {
          throw error; // Re-throw to stop processing
        }

        return errorInfo;
      }
    })
  );

  // Wait for all promises to complete
  try {
    await Promise.all(promises);
  } catch (error) {
    // Only reached if continueOnError is false
    logger.error(`[${context}] Parallel processing stopped due to error`, {
      error: error.message,
    });
    throw error;
  }

  const duration = Date.now() - startTime;
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const summary = {
    total: items.length,
    successful,
    failed,
    duration,
    concurrency,
  };

  logger.info(
    `[${context}] Parallel processing completed: ${successful}/${items.length} successful, ${failed} failed, ${duration}ms`
  );

  if (failed > 0) {
    logger.warn(
      `[${context}] ${failed} items failed during parallel processing`,
      {
        total: items.length,
        successful,
        failed,
      }
    );
  }

  // MEMORY FIX: If streaming, results array contains nulls (results were processed via callback)
  // Return empty array or minimal data
  const finalResults = streamResults
    ? [] // Results were processed via onResult callback, don't return them
    : results
        .map((r) => (r.success ? r.result : null))
        .filter((r) => r !== null);

  // MEMORY FIX: Clear intermediate arrays if streaming to help GC
  if (streamResults) {
    // Clear result objects from array (keep structure for summary calculation)
    results.forEach((r) => {
      if (r.success) {
        r.result = null; // Clear result to help GC
      }
    });
  }

  return {
    results: finalResults,
    errors,
    summary,
    rawResults: streamResults ? [] : results, // Don't include rawResults when streaming
  };
}

/**
 * Process items in parallel and return only successful results
 * Convenience wrapper around processInParallel that filters out errors
 *
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Async function that processes a single item
 * @param {number} concurrency - Maximum number of concurrent operations (default: 3)
 * @param {Object} options - Additional options (same as processInParallel)
 * @returns {Promise<Array>} Array of successful results only
 */
async function processInParallelSuccessOnly(
  items,
  processor,
  concurrency = 3,
  options = {}
) {
  const { results } = await processInParallel(
    items,
    processor,
    concurrency,
    options
  );
  return results;
}

/**
 * Process items in batches with parallel processing within each batch
 * Useful for very large arrays where you want to process in batches
 * but still use parallelism within each batch
 *
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Async function that processes a single item
 * @param {number} batchSize - Number of items per batch
 * @param {number} concurrency - Maximum concurrent operations per batch (default: 3)
 * @param {Object} options - Additional options
 * @returns {Promise<{results: Array, errors: Array, summary: Object}>} Combined results from all batches
 */
async function processInBatches(
  items,
  processor,
  batchSize,
  concurrency = 3,
  options = {}
) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  logger.info(
    `Processing ${items.length} items in ${batches.length} batches (${batchSize} items per batch)`
  );

  const allResults = [];
  const allErrors = [];
  let totalSuccessful = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    logger.info(
      `Processing batch ${i + 1}/${batches.length} (${batch.length} items)`
    );

    const { results, errors, summary } = await processInParallel(
      batch,
      processor,
      concurrency,
      {
        ...options,
        context: `batch-${i + 1}`,
      }
    );

    // MEMORY FIX: Extract results immediately and add to accumulator
    allResults.push(...results);
    allErrors.push(...errors);
    totalSuccessful += summary.successful;
    totalFailed += summary.failed;

    // MEMORY FIX: Clear batch results immediately after extracting
    // Note: results and errors are already copied to allResults/allErrors above
    // Setting to null helps GC, but arrays are already cleared in processInParallel if streaming
    // For non-streaming mode, we can't clear here as they're returned, but we've already copied them

    // MEMORY FIX: Force GC hint after every 5 batches
    if (i > 0 && i % 5 === 0 && global.gc) {
      global.gc();
    }
  }

  const duration = Date.now() - startTime;

  return {
    results: allResults,
    errors: allErrors,
    summary: {
      total: items.length,
      successful: totalSuccessful,
      failed: totalFailed,
      duration,
      batches: batches.length,
      batchSize,
      concurrency,
    },
  };
}

module.exports = {
  processInParallel,
  processInParallelSuccessOnly,
  processInBatches,
};
