/**
 * Integration Test Runner
 * Runs all integration tests for parallel processing functionality
 *
 * Usage: node __tests__/integration/runIntegrationTests.js [testName] [args...]
 *
 * Examples:
 *   node __tests__/integration/runIntegrationTests.js all
 *   node __tests__/integration/runIntegrationTests.js competitions 27958 club
 *   node __tests__/integration/runIntegrationTests.js gamedata 27958
 *   node __tests__/integration/runIntegrationTests.js validation 10
 */

const { spawn } = require("child_process");
const path = require("path");

const tests = {
  competitions: {
    path: path.join(__dirname, "..", "testParallelCompetitions.js"),
    description: "Test parallel competitions processing",
    args: ["<clubId>", "[type]"],
  },
  gamedata: {
    path: path.join(__dirname, "testParallelGameData.js"),
    description: "Test parallel game data processing",
    args: ["<clubId>"],
  },
  validation: {
    path: path.join(__dirname, "testParallelFixtureValidation.js"),
    description: "Test parallel fixture validation",
    args: ["[count]"],
  },
};

function showUsage() {
  console.log("\n" + "=".repeat(80));
  console.log("Integration Test Runner");
  console.log("=".repeat(80));
  console.log("\nUsage: node __tests__/integration/runIntegrationTests.js [testName] [args...]\n");
  console.log("Available tests:");
  Object.entries(tests).forEach(([name, test]) => {
    console.log(`  ${name}: ${test.description}`);
    console.log(`    Args: ${test.args.join(" ")}`);
  });
  console.log("\nExamples:");
  console.log("  node __tests__/integration/runIntegrationTests.js competitions 27958 club");
  console.log("  node __tests__/integration/runIntegrationTests.js gamedata 27958");
  console.log("  node __tests__/integration/runIntegrationTests.js validation 10");
  console.log("\n");
}

async function runTest(testPath, testName, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Running: ${testName}`);
    console.log("=".repeat(80));

    const testProcess = spawn("node", [testPath, ...args], {
      stdio: "inherit",
      shell: true,
    });

    testProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`\n✅ ${testName} passed\n`);
        resolve(true);
      } else {
        console.log(`\n❌ ${testName} failed with exit code ${code}\n`);
        resolve(false);
      }
    });

    testProcess.on("error", (error) => {
      console.error(`\n❌ Error running ${testName}:`, error);
      reject(error);
    });
  });
}

async function runAllTests() {
  const testName = process.argv[2]?.toLowerCase();
  const testArgs = process.argv.slice(3);

  if (!testName) {
    showUsage();
    process.exit(1);
  }

  if (testName === "all") {
    console.log("⚠️  'all' option not available for integration tests.");
    console.log("Integration tests require specific arguments (club IDs, etc.).");
    console.log("Please run tests individually with required arguments.\n");
    showUsage();
    process.exit(1);
  }

  if (!tests[testName]) {
    console.error(`❌ Unknown test: ${testName}`);
    showUsage();
    process.exit(1);
  }

  const test = tests[testName];

  // Check if required args are provided
  if (testName === "competitions" && testArgs.length === 0) {
    console.error("❌ Error: competitions test requires at least a club ID");
    console.log(`Usage: node __tests__/integration/runIntegrationTests.js competitions <clubId> [type]`);
    process.exit(1);
  }

  if (testName === "gamedata" && testArgs.length === 0) {
    console.error("❌ Error: gamedata test requires a club ID");
    console.log(`Usage: node __tests__/integration/runIntegrationTests.js gamedata <clubId>`);
    process.exit(1);
  }

  try {
    const passed = await runTest(test.path, testName, testArgs);
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error(`Error running ${testName}:`, error);
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("Unhandled error in test runner:", error);
  process.exit(1);
});

