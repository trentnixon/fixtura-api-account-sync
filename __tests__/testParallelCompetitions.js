/**
 * Test Script for Parallel Competitions Processing
 * Tests Strategy 1: Parallel Page Processing for GetCompetitions
 *
 * Usage: node __tests__/testParallelCompetitions.js <id> [type]
 *   type: "club" (default) or "association"
 *
 * Examples:
 *   node __tests__/testParallelCompetitions.js 27958 club
 *   node __tests__/testParallelCompetitions.js 3292 association
 */

require("dotenv").config();
const logger = require("../src/utils/logger");
const GetCompetitions = require("../dataProcessing/scrapeCenter/Competitions/getCompetitions");
const CRUDOperations = require("../dataProcessing/services/CRUDoperations");
const ProcessingTracker = require("../dataProcessing/services/processingTracker");
const PuppeteerManager = require("../dataProcessing/puppeteer/PuppeteerManager");
const { PARALLEL_CONFIG } = require("../dataProcessing/puppeteer/constants");

// Get ID and type from command line
// Usage: node testParallelCompetitions.js <id> [type]
// type: "club" (default) or "association"
const id = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const type = (process.argv[3] || "club").toUpperCase();

console.log("Test script starting...");
console.log("ID:", id);
console.log("Type:", type);

async function testParallelCompetitions() {
  console.log("\n" + "=".repeat(80));
  console.log("Testing Parallel Competitions Processing");
  console.log("=".repeat(80) + "\n");

  if (!id) {
    console.error("❌ Error: Please provide an ID as argument");
    console.log(
      "Usage: node __tests__/testParallelCompetitions.js <id> [type]"
    );
    console.log("  type: 'club' (default) or 'association'");
    console.log("Examples:");
    console.log("  node __tests__/testParallelCompetitions.js 27958 club");
    console.log(
      "  node __tests__/testParallelCompetitions.js 3292 association"
    );
    process.exit(1);
  }

  const crudOps = new CRUDOperations();
  // Initialize ProcessingTracker (it creates its own CRUDOperations instance)
  const processingTracker = new ProcessingTracker();
  const puppeteerManager = PuppeteerManager.getInstance();

  try {
    let getCompetitions;
    let accountType;
    let associations = [];
    let isParallel = false;

    if (type === "ASSOCIATION") {
      // Test with single association
      console.log(`📋 Fetching association data for ID: ${id}`);
      const associationData = await crudOps.fetchDataForAssociation(id);

      if (!associationData || !associationData.attributes) {
        console.error(`❌ Error: Association ${id} not found`);
        process.exit(1);
      }

      accountType = "ASSOCIATION";
      const associationUrl = associationData.attributes.href || "";

      console.log(
        `✅ Found association: ${associationData.attributes.name || id}`
      );
      console.log(`   URL: ${associationUrl}\n`);

      // Create GetCompetitions instance for association
      getCompetitions = new GetCompetitions(
        {
          TYPEID: id,
          TYPEURL: associationUrl,
        },
        {
          ACCOUNTTYPE: accountType,
        },
        processingTracker
      );

      console.log("🚀 Starting association competitions processing...");
      console.log(
        "   Note: Single association uses sequential processing (no parallel needed)\n"
      );
    } else {
      // Test with club (parallel processing)
      console.log(`📋 Fetching club data for ID: ${id}`);
      const clubData = await crudOps.fetchDataForClub(id);

      if (
        !clubData ||
        !clubData.attributes ||
        !clubData.attributes.associations
      ) {
        console.error(`❌ Error: Club ${id} not found or has no associations`);
        process.exit(1);
      }

      accountType = "CLUB";
      associations = clubData.attributes.associations.data;
      console.log(
        `✅ Found ${associations.length} associations for club ${id}\n`
      );

      if (associations.length === 0) {
        console.log(
          "⚠️  No associations found. Cannot test parallel processing."
        );
        process.exit(0);
      }

      // Display associations
      console.log("Associations to process:");
      associations.forEach((assoc, index) => {
        console.log(
          `  ${index + 1}. ID: ${assoc.id}, URL: ${assoc.attributes.href}`
        );
      });
      console.log("");

      // Create GetCompetitions instance for club
      getCompetitions = new GetCompetitions(
        {
          TYPEID: id,
          TYPEURL: clubData.attributes.href || "",
        },
        {
          ACCOUNTTYPE: accountType,
        },
        processingTracker
      );

      isParallel = true;
      // Test parallel processing
      console.log("🚀 Starting parallel competitions processing...");
      console.log(
        `   Concurrency: ${PARALLEL_CONFIG.COMPETITIONS_CONCURRENCY}`
      );
      console.log(`   Page Pool Size: ${PARALLEL_CONFIG.PAGE_POOL_SIZE}\n`);
    }

    const startTime = Date.now();

    // Create page pool before processing (only for clubs with parallel processing)
    if (isParallel) {
      console.log("📦 Creating page pool...");
      const poolSize = PARALLEL_CONFIG.PAGE_POOL_SIZE;
      await puppeteerManager.createPagePool(poolSize);
      console.log(`✅ Page pool created with ${poolSize} pages\n`);
    }

    const competitions = await getCompetitions.setup();

    const duration = Date.now() - startTime;

    // Display results
    console.log("\n" + "=".repeat(80));
    console.log("Results");
    console.log("=".repeat(80));
    console.log(
      `✅ Processing completed in ${duration}ms (${(duration / 1000).toFixed(
        2
      )}s)`
    );
    console.log(`📊 Total competitions found: ${competitions.length}`);

    if (isParallel && associations.length > 0) {
      const averageTimePerAssociation = duration / associations.length;
      console.log(
        `⚡ Average time per association: ${averageTimePerAssociation.toFixed(
          2
        )}ms (${(averageTimePerAssociation / 1000).toFixed(2)}s)`
      );
    }

    if (competitions.length > 0) {
      console.log("\n📋 Sample competitions (first 5):");
      competitions.slice(0, 5).forEach((comp, index) => {
        console.log(
          `  ${index + 1}. ${comp.competitionName} - ${comp.season} (${
            comp.status
          })`
        );
      });
      if (competitions.length > 5) {
        console.log(`  ... and ${competitions.length - 5} more`);
      }
    }

    // Performance analysis (only for parallel processing)
    if (isParallel && associations.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Performance Analysis");
      console.log("=".repeat(80));

      // Calculate estimated sequential time
      // If processed sequentially, each association would take approximately the average time
      // So total sequential time = average time × number of associations
      // Since they processed in parallel, the actual time is the duration (longest of the parallel operations)
      const averageTimePerAssociation = duration / associations.length;
      const estimatedSequentialTime =
        averageTimePerAssociation * associations.length;
      const speedup = estimatedSequentialTime / duration;
      const timeSaved = estimatedSequentialTime - duration;

      console.log(
        `📈 Estimated sequential time (if processed one-by-one): ${estimatedSequentialTime.toFixed(
          2
        )}ms (${(estimatedSequentialTime / 1000).toFixed(2)}s)`
      );
      console.log(
        `⚡ Actual parallel time: ${duration}ms (${(duration / 1000).toFixed(
          2
        )}s)`
      );
      console.log(`🚀 Speedup: ${speedup.toFixed(2)}x`);
      console.log(
        `⏱️  Time saved: ${timeSaved.toFixed(2)}ms (${(
          timeSaved / 1000
        ).toFixed(2)}s)`
      );

      // Note about speedup calculation
      console.log(
        "\n💡 Note: Speedup calculation assumes sequential processing would take"
      );
      console.log(
        `   (average time × number of associations). Actual speedup may vary based on`
      );
      console.log(
        `   network conditions, proxy performance, and page load times.`
      );
    } else {
      console.log(
        "\n💡 Note: Single association processing uses sequential mode (no parallel processing needed)"
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

// Run the test with error handling
testParallelCompetitions().catch((error) => {
  console.error("Unhandled error in test:", error);
  process.exit(1);
});
