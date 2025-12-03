/**
 * Integration Test for Parallel Game Data Processing
 * Tests Phase 7.2: Integration Testing - Game Data
 *
 * Usage: node __tests__/integration/testParallelGameData.js [clubId]
 *
 * Example: node __tests__/integration/testParallelGameData.js 27958
 */

require("dotenv").config();
const logger = require("../../src/utils/logger");
const GetTeamsGameData = require("../../dataProcessing/scrapeCenter/GameData/getGameData");
const CRUDOperations = require("../../dataProcessing/services/CRUDoperations");
const ProcessingTracker = require("../../dataProcessing/services/processingTracker");
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");
const { PARALLEL_CONFIG } = require("../../dataProcessing/puppeteer/constants");

// Get club ID from command line
const clubId = process.argv[2] ? parseInt(process.argv[2], 10) : null;

async function testParallelGameData() {
  console.log("\n" + "=".repeat(80));
  console.log("Integration Test: Parallel Game Data Processing");
  console.log("=".repeat(80) + "\n");

  if (!clubId) {
    console.error("❌ Error: Please provide a club ID as argument");
    console.log("Usage: node __tests__/integration/testParallelGameData.js <clubId>");
    console.log("Example: node __tests__/integration/testParallelGameData.js 27958");
    process.exit(1);
  }

  const crudOps = new CRUDOperations();
  const processingTracker = new ProcessingTracker();
  const puppeteerManager = PuppeteerManager.getInstance();

  try {
    // Fetch club data to get teams
    console.log(`📋 Fetching club data for ID: ${clubId}`);
    const clubData = await crudOps.fetchDataForClub(clubId);

    if (!clubData || !clubData.attributes || !clubData.attributes.teams) {
      console.error(`❌ Error: Club ${clubId} not found or has no teams`);
      process.exit(1);
    }

    const teams = clubData.attributes.teams.data;
    console.log(`✅ Found ${teams.length} teams for club ${clubId}\n`);

    if (teams.length === 0) {
      console.log("⚠️  No teams found. Cannot test parallel processing.");
      process.exit(0);
    }

    // Display teams
    console.log("Teams to process (first 10):");
    teams.slice(0, 10).forEach((team, index) => {
      console.log(
        `  ${index + 1}. ID: ${team.id}, Name: ${team.attributes.name || "N/A"}`
      );
    });
    if (teams.length > 10) {
      console.log(`  ... and ${teams.length - 10} more`);
    }
    console.log("");

    // Create page pool
    console.log("📦 Creating page pool...");
    const poolSize = PARALLEL_CONFIG.PAGE_POOL_SIZE;
    await puppeteerManager.createPagePool(poolSize);
    console.log(`✅ Page pool created with ${poolSize} pages\n`);

    // Test parallel processing
    console.log("🚀 Starting parallel game data processing...");
    console.log(`   Concurrency: ${PARALLEL_CONFIG.TEAMS_CONCURRENCY}`);
    console.log(`   Page Pool Size: ${PARALLEL_CONFIG.PAGE_POOL_SIZE}`);
    console.log(`   Teams to process: ${teams.length}\n`);

    const startTime = Date.now();

    // Create GetTeamsGameData instance
    const getGameData = new GetTeamsGameData({
      TEAMS: teams,
      ACCOUNT: {
        ACCOUNTID: clubId,
        ACCOUNTTYPE: "CLUB",
      },
    });

    const gameData = await getGameData.setup();

    const duration = Date.now() - startTime;

    // Display results
    console.log("\n" + "=".repeat(80));
    console.log("Results");
    console.log("=".repeat(80));
    console.log(
      `✅ Processing completed in ${duration}ms (${(duration / 1000).toFixed(2)}s)`
    );
    console.log(`📊 Total games found: ${gameData.length}`);

    if (teams.length > 0) {
      const averageTimePerTeam = duration / teams.length;
      console.log(
        `⚡ Average time per team: ${averageTimePerTeam.toFixed(2)}ms (${(averageTimePerTeam / 1000).toFixed(2)}s)`
      );
    }

    if (gameData.length > 0) {
      console.log("\n📋 Sample games (first 5):");
      gameData.slice(0, 5).forEach((game, index) => {
        console.log(
          `  ${index + 1}. ${game.teamHome || "N/A"} vs ${game.teamAway || "N/A"} - ${game.date || "N/A"} (${game.status || "N/A"})`
        );
      });
      if (gameData.length > 5) {
        console.log(`  ... and ${gameData.length - 5} more`);
      }
    }

    // Performance analysis
    if (teams.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Performance Analysis");
      console.log("=".repeat(80));

      const averageTimePerTeam = duration / teams.length;
      const estimatedSequentialTime = averageTimePerTeam * teams.length;
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
testParallelGameData().catch((error) => {
  console.error("Unhandled error in test:", error);
  process.exit(1);
});

