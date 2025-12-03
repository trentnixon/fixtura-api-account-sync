/**
 * Integration Test for Parallel Fixture Validation
 * Tests Phase 7.2: Integration Testing - Fixture Validation
 *
 * Usage: node __tests__/integration/testParallelFixtureValidation.js [count]
 *
 * Example: node __tests__/integration/testParallelFixtureValidation.js 10
 */

require("dotenv").config();
const logger = require("../../src/utils/logger");
const FixtureValidationService = require("../../dataProcessing/services/fixtureValidationService");
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");
const { PARALLEL_CONFIG } = require("../../dataProcessing/puppeteer/constants");

// Get fixture count from command line (default: 10)
const fixtureCount = process.argv[2] ? parseInt(process.argv[2], 10) : 10;

async function testParallelFixtureValidation() {
  console.log("\n" + "=".repeat(80));
  console.log("Integration Test: Parallel Fixture Validation");
  console.log("=".repeat(80) + "\n");

  const puppeteerManager = PuppeteerManager.getInstance();
  const validationService = new FixtureValidationService({
    usePuppeteer: true,
    skipHttpValidation: false,
  });

  try {
    // Create test fixtures (mock data)
    console.log(`📋 Creating ${fixtureCount} test fixtures...`);
    const testFixtures = [];
    for (let i = 1; i <= fixtureCount; i++) {
      testFixtures.push({
        id: i,
        gameID: `game-${i}`,
        urlToScoreCard: `https://www.playhq.com/cricket-new-zealand/org/test-competition/game/${i}`,
      });
    }
    console.log(`✅ Created ${testFixtures.length} test fixtures\n`);

    // Create page pool
    console.log("📦 Creating page pool...");
    const poolSize = PARALLEL_CONFIG.PAGE_POOL_SIZE;
    await puppeteerManager.createPagePool(poolSize);
    console.log(`✅ Page pool created with ${poolSize} pages\n`);

    // Test parallel validation
    console.log("🚀 Starting parallel fixture validation...");
    console.log(`   Concurrency: ${PARALLEL_CONFIG.VALIDATION_CONCURRENCY}`);
    console.log(`   Page Pool Size: ${PARALLEL_CONFIG.PAGE_POOL_SIZE}`);
    console.log(`   Fixtures to validate: ${testFixtures.length}\n`);

    const startTime = Date.now();

    const results = await validationService.validateFixturesBatch(
      testFixtures,
      PARALLEL_CONFIG.VALIDATION_CONCURRENCY
    );

    const duration = Date.now() - startTime;

    // Display results
    console.log("\n" + "=".repeat(80));
    console.log("Results");
    console.log("=".repeat(80));
    console.log(
      `✅ Validation completed in ${duration}ms (${(duration / 1000).toFixed(2)}s)`
    );

    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.filter((r) => !r.valid).length;

    console.log(`📊 Total fixtures validated: ${results.length}`);
    console.log(`✅ Valid: ${validCount}`);
    console.log(`❌ Invalid: ${invalidCount}`);

    if (testFixtures.length > 0) {
      const averageTimePerFixture = duration / testFixtures.length;
      console.log(
        `⚡ Average time per fixture: ${averageTimePerFixture.toFixed(2)}ms (${(averageTimePerFixture / 1000).toFixed(2)}s)`
      );
    }

    // Show sample results
    if (results.length > 0) {
      console.log("\n📋 Sample validation results (first 5):");
      results.slice(0, 5).forEach((result, index) => {
        const status = result.valid ? "✅ VALID" : "❌ INVALID";
        console.log(
          `  ${index + 1}. ${status} - ${result.url || "N/A"} (${result.status || "N/A"})`
        );
      });
      if (results.length > 5) {
        console.log(`  ... and ${results.length - 5} more`);
      }
    }

    // Performance analysis
    if (testFixtures.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Performance Analysis");
      console.log("=".repeat(80));

      const averageTimePerFixture = duration / testFixtures.length;
      const estimatedSequentialTime = averageTimePerFixture * testFixtures.length;
      const speedup = estimatedSequentialTime / duration;
      const timeSaved = estimatedSequentialTime - duration;

      console.log(
        `📈 Estimated sequential time (if processed one-by-one): ${estimatedSequentialTime.toFixed(2)}ms (${(estimatedSequentialTime / 1000).toFixed(2)}s)`
      );
      console.log(
        `⚡ Actual parallel time: ${duration}ms (${(duration / 1000).toFixed(2)}s)`
      );
      console.log(`🚀 Speedup: ${speedup.toFixed(2)}x`);
      console.log(
        `⏱️  Time saved: ${timeSaved.toFixed(2)}ms (${(timeSaved / 1000).toFixed(2)}s)`
      );
    }

    // Memory stats
    const memoryStats = puppeteerManager.getMemoryStats();
    console.log("\n💾 Memory Usage:");
    console.log(`   RSS: ${memoryStats.rss}`);
    console.log(`   Heap Used: ${memoryStats.heapUsed}`);
    console.log(`   Operations: ${memoryStats.operationCount}`);

    console.log("\n✅ Test completed successfully!");

    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await puppeteerManager.dispose();
    console.log("✅ Cleanup complete");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    logger.error("Test failed", { error: error.message, stack: error.stack });

    // Cleanup on error
    try {
      await puppeteerManager.dispose();
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    process.exit(1);
  }
}

// Run the test
testParallelFixtureValidation().catch((error) => {
  console.error("Unhandled error in test:", error);
  process.exit(1);
});

