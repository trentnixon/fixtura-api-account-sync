/**
 * Unit Tests for Parallel Processing Utilities
 * Tests Phase 1.2: Parallel Processing Utilities
 *
 * Usage: node __tests__/unit/testParallelUtils.js
 */

require("dotenv").config();
const { processInParallel, processInParallelSuccessOnly, processInBatches } = require("../../dataProcessing/utils/parallelUtils");
const logger = require("../../src/utils/logger");

async function testParallelUtils() {
  console.log("\n" + "=".repeat(80));
  console.log("Testing Parallel Processing Utilities");
  console.log("=".repeat(80) + "\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Basic parallel processing
    console.log("Test 1: Basic parallel processing");
    try {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
        return item * 2;
      };

      const { results, errors, summary } = await processInParallel(items, processor, 3);

      if (results.length === 5 && errors.length === 0 && summary.successful === 5) {
        console.log(`  ✅ PASS: Processed ${results.length} items successfully`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Expected 5 results, got ${results.length} (errors: ${errors.length})`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in basic parallel processing: ${error.message}`);
      testsFailed++;
    }

    // Test 2: Error handling (some items fail)
    console.log("\nTest 2: Error handling (some items fail)");
    try {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (item === 3) {
          throw new Error("Item 3 failed");
        }
        return item * 2;
      };

      const { results, errors, summary } = await processInParallel(items, processor, 3, {
        continueOnError: true,
      });

      if (results.length === 4 && errors.length === 1 && summary.successful === 4 && summary.failed === 1) {
        console.log(`  ✅ PASS: Handled errors correctly (${summary.successful} success, ${summary.failed} failed)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Expected 4 results and 1 error, got ${results.length} results and ${errors.length} errors`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in error handling test: ${error.message}`);
      testsFailed++;
    }

    // Test 3: Empty array
    console.log("\nTest 3: Empty array handling");
    try {
      const items = [];
      const processor = async (item) => item * 2;

      const { results, errors, summary } = await processInParallel(items, processor, 3);

      if (results.length === 0 && errors.length === 0 && summary.total === 0) {
        console.log(`  ✅ PASS: Handled empty array correctly`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Expected empty results, got ${results.length} results`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in empty array test: ${error.message}`);
      testsFailed++;
    }

    // Test 4: Single item
    console.log("\nTest 4: Single item handling");
    try {
      const items = [42];
      const processor = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return item * 2;
      };

      const { results, errors, summary } = await processInParallel(items, processor, 3);

      if (results.length === 1 && results[0] === 84 && summary.successful === 1) {
        console.log(`  ✅ PASS: Handled single item correctly (result: ${results[0]})`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Expected 1 result with value 84, got ${results.length} results`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in single item test: ${error.message}`);
      testsFailed++;
    }

    // Test 5: Concurrency limit
    console.log("\nTest 5: Concurrency limit enforcement");
    try {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const processor = async (item) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return item;
      };

      const { results } = await processInParallel(items, processor, 3);

      if (maxConcurrent <= 3 && results.length === 10) {
        console.log(`  ✅ PASS: Concurrency limited correctly (max concurrent: ${maxConcurrent}, limit: 3)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Concurrency not limited (max concurrent: ${maxConcurrent}, expected <= 3)`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in concurrency test: ${error.message}`);
      testsFailed++;
    }

    // Test 6: processInParallelSuccessOnly
    console.log("\nTest 6: processInParallelSuccessOnly wrapper");
    try {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (item === 3) {
          throw new Error("Item 3 failed");
        }
        return item * 2;
      };

      const results = await processInParallelSuccessOnly(items, processor, 3, {
        continueOnError: true,
      });

      if (results.length === 4 && !results.includes(6)) {
        console.log(`  ✅ PASS: Success-only wrapper filtered errors correctly (${results.length} results)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Expected 4 results without failed item, got ${results.length} results`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in success-only test: ${error.message}`);
      testsFailed++;
    }

    // Test 7: processInBatches
    console.log("\nTest 7: processInBatches (batch processing)");
    try {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processor = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return item * 2;
      };

      const { results, summary } = await processInBatches(items, processor, 5, 2, {
        context: "batch_test",
      });

      if (results.length === 10 && summary.successful === 10) {
        console.log(`  ✅ PASS: Batch processing worked correctly (${results.length} results in batches)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Expected 10 results, got ${results.length}`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in batch processing test: ${error.message}`);
      testsFailed++;
    }

    // Test 8: Timing information
    console.log("\nTest 8: Timing information in summary");
    try {
      const items = [1, 2, 3];
      const processor = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return item;
      };

      const { summary } = await processInParallel(items, processor, 2);

      if (summary.duration && summary.duration > 0 && summary.duration < 200) {
        console.log(`  ✅ PASS: Timing information included (duration: ${summary.duration}ms)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Timing information incorrect (duration: ${summary.duration}ms)`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error in timing test: ${error.message}`);
      testsFailed++;
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("Test Summary");
    console.log("=".repeat(80));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📊 Total Tests: ${testsPassed + testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

    if (testsFailed === 0) {
      console.log("\n🎉 All tests passed!");
    } else {
      console.log(`\n⚠️  ${testsFailed} test(s) failed`);
    }

  } catch (error) {
    console.error("\n❌ Test suite failed with error:", error);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
testParallelUtils().catch((error) => {
  console.error("Unhandled error in test suite:", error);
  process.exit(1);
});

