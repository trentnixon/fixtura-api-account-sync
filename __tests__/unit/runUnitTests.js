/**
 * Unit Test Runner
 * Runs all unit tests for parallel processing functionality
 *
 * Usage: node __tests__/unit/runUnitTests.js [testName]
 *   testName: "pagepool", "parallelutils", or "all" (default)
 *
 * Examples:
 *   node __tests__/unit/runUnitTests.js all
 *   node __tests__/unit/runUnitTests.js pagepool
 *   node __tests__/unit/runUnitTests.js parallelutils
 */

const { spawn } = require("child_process");
const path = require("path");

const tests = {
  pagepool: path.join(__dirname, "testPagePool.js"),
  parallelutils: path.join(__dirname, "testParallelUtils.js"),
};

async function runTest(testPath, testName) {
  return new Promise((resolve, reject) => {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Running: ${testName}`);
    console.log("=".repeat(80));

    const testProcess = spawn("node", [testPath], {
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
  const testName = process.argv[2]?.toLowerCase() || "all";
  const results = [];

  if (testName === "all") {
    // Run all tests
    for (const [name, path] of Object.entries(tests)) {
      try {
        const passed = await runTest(path, name);
        results.push({ name, passed });
      } catch (error) {
        console.error(`Error running ${name}:`, error);
        results.push({ name, passed: false });
      }
    }
  } else if (tests[testName]) {
    // Run specific test
    try {
      const passed = await runTest(tests[testName], testName);
      results.push({ name: testName, passed });
    } catch (error) {
      console.error(`Error running ${testName}:`, error);
      results.push({ name: testName, passed: false });
    }
  } else {
    console.error(`Unknown test: ${testName}`);
    console.log("Available tests:", Object.keys(tests).join(", "));
    process.exit(1);
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("Unit Test Suite Summary");
  console.log("=".repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: ${result.name}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("=".repeat(80));

  if (failed === 0) {
    console.log("\n🎉 All unit tests passed!");
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test suite(s) failed`);
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("Unhandled error in test runner:", error);
  process.exit(1);
});

