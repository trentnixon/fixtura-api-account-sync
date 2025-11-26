/**
 * Phase 2 Testing: Direct Data Fetching Functions
 *
 * Tests the new direct org data fetching functions that bypass account lookup:
 * - fetchClubDirectData(clubId)
 * - fetchAssociationDirectData(associationId)
 * - getPseudoAccountId(orgType)
 * - fetchDataDirect(orgId, orgType)
 */

const DataService = require("../dataProcessing/services/dataService");
const {
  fetchClubDirectData,
  fetchAssociationDirectData,
} = require("../dataProcessing/utils/ProcessorUtils");
const logger = require("../src/utils/logger");

// Test data - Using real IDs from CMS
// User provided IDs for testing
const TEST_CLUB_ID = 27958; // Real club ID from CMS
const TEST_ASSOCIATION_ID = 3292; // Real association ID from CMS

class Phase2TestRunner {
  constructor() {
    this.dataService = new DataService();
    this.results = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  log(message, type = "info") {
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    console.log(`${prefix} ${message}`);
  }

  async test(name, testFn) {
    try {
      this.log(`Testing: ${name}...`, "info");
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: "passed" });
      this.log(`✅ PASSED: ${name}`, "success");
      return true;
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: "failed", error: error.message });
      this.log(`❌ FAILED: ${name} - ${error.message}`, "error");
      logger.error(`Phase 2 Test Failed: ${name}`, {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  async runAllTests() {
    console.log("\n" + "=".repeat(60));
    console.log("PHASE 2 TESTING: Direct Data Fetching Functions");
    console.log("=".repeat(60) + "\n");

    // Test 1: Pseudo Account ID Resolution
    await this.test(
      "getPseudoAccountId() returns admin account ID or null",
      async () => {
        const pseudoAccountId = this.dataService.getPseudoAccountId("CLUB");

        // Should return either a number (admin account ID) or null
        if (pseudoAccountId !== null && typeof pseudoAccountId !== "number") {
          throw new Error(
            `Expected number or null, got ${typeof pseudoAccountId}`
          );
        }

        this.log(
          `   Pseudo Account ID: ${pseudoAccountId || "null (not configured)"}`,
          "info"
        );

        if (!pseudoAccountId) {
          this.log(
            "   ⚠️  Warning: ADMIN_ACCOUNT_ID not set in environment",
            "info"
          );
        }
      }
    );

    // Test 2: Fetch Club Direct Data
    await this.test(`fetchClubDirectData(${TEST_CLUB_ID})`, async () => {
      const result = await fetchClubDirectData(TEST_CLUB_ID);

      // Validate structure
      if (!result.clubObj) {
        throw new Error("Missing clubObj in result");
      }

      if (!result.clubObj.TYPEID) {
        throw new Error("Missing TYPEID in clubObj");
      }

      if (result.clubObj.TYPEID !== TEST_CLUB_ID) {
        throw new Error(
          `TYPEID mismatch: expected ${TEST_CLUB_ID}, got ${result.clubObj.TYPEID}`
        );
      }

      if (!result.details) {
        throw new Error("Missing details in result");
      }

      if (!result.details.attributes) {
        throw new Error("Missing attributes in details");
      }

      this.log(`   Club ID: ${result.clubObj.TYPEID}`, "info");
      this.log(`   Club URL: ${result.clubObj.TYPEURL || "N/A"}`, "info");
      this.log(
        `   Club Name: ${result.details.attributes.name || "N/A"}`,
        "info"
      );
    });

    // Test 3: Fetch Association Direct Data
    await this.test(
      `fetchAssociationDirectData(${TEST_ASSOCIATION_ID})`,
      async () => {
        const result = await fetchAssociationDirectData(TEST_ASSOCIATION_ID);

        // Validate structure
        if (!result.associationObj) {
          throw new Error("Missing associationObj in result");
        }

        if (!result.associationObj.TYPEID) {
          throw new Error("Missing TYPEID in associationObj");
        }

        if (result.associationObj.TYPEID !== TEST_ASSOCIATION_ID) {
          throw new Error(
            `TYPEID mismatch: expected ${TEST_ASSOCIATION_ID}, got ${result.associationObj.TYPEID}`
          );
        }

        if (!result.details) {
          throw new Error("Missing details in result");
        }

        if (!result.details.attributes) {
          throw new Error("Missing attributes in details");
        }

        this.log(`   Association ID: ${result.associationObj.TYPEID}`, "info");
        this.log(
          `   Association URL: ${result.associationObj.TYPEURL || "N/A"}`,
          "info"
        );
        this.log(
          `   Association Name: ${result.details.attributes.name || "N/A"}`,
          "info"
        );
      }
    );

    // Test 4: Fetch Data Direct for Club
    await this.test(`fetchDataDirect(${TEST_CLUB_ID}, "CLUB")`, async () => {
      const dataObj = await this.dataService.fetchDataDirect(
        TEST_CLUB_ID,
        "CLUB"
      );

      // Validate structure matches existing format
      if (!dataObj.TYPEOBJ) {
        throw new Error("Missing TYPEOBJ in dataObj");
      }

      if (!dataObj.ACCOUNT) {
        throw new Error("Missing ACCOUNT in dataObj");
      }

      if (!dataObj.ACCOUNT.ACCOUNTID) {
        throw new Error("Missing ACCOUNTID in ACCOUNT object");
      }

      if (dataObj.ACCOUNT.ACCOUNTTYPE !== "CLUB") {
        throw new Error(
          `ACCOUNTTYPE mismatch: expected "CLUB", got "${dataObj.ACCOUNT.ACCOUNTTYPE}"`
        );
      }

      if (dataObj.TYPEOBJ.TYPEID !== TEST_CLUB_ID) {
        throw new Error(
          `TYPEOBJ.TYPEID mismatch: expected ${TEST_CLUB_ID}, got ${dataObj.TYPEOBJ.TYPEID}`
        );
      }

      if (!dataObj.DETAILS) {
        throw new Error("Missing DETAILS in dataObj");
      }

      // TEAMS and Grades may be empty arrays, which is OK
      if (!Array.isArray(dataObj.TEAMS)) {
        throw new Error("TEAMS must be an array");
      }

      this.log(`   Pseudo Account ID: ${dataObj.ACCOUNT.ACCOUNTID}`, "info");
      this.log(`   Club ID: ${dataObj.TYPEOBJ.TYPEID}`, "info");
      this.log(`   Teams Count: ${dataObj.TEAMS.length}`, "info");
      this.log(`   Grades Count: ${dataObj.Grades?.length || 0}`, "info");
    });

    // Test 5: Fetch Data Direct for Association
    await this.test(
      `fetchDataDirect(${TEST_ASSOCIATION_ID}, "ASSOCIATION")`,
      async () => {
        const dataObj = await this.dataService.fetchDataDirect(
          TEST_ASSOCIATION_ID,
          "ASSOCIATION"
        );

        // Validate structure matches existing format
        if (!dataObj.TYPEOBJ) {
          throw new Error("Missing TYPEOBJ in dataObj");
        }

        if (!dataObj.ACCOUNT) {
          throw new Error("Missing ACCOUNT in dataObj");
        }

        if (!dataObj.ACCOUNT.ACCOUNTID) {
          throw new Error("Missing ACCOUNTID in ACCOUNT object");
        }

        if (dataObj.ACCOUNT.ACCOUNTTYPE !== "ASSOCIATION") {
          throw new Error(
            `ACCOUNTTYPE mismatch: expected "ASSOCIATION", got "${dataObj.ACCOUNT.ACCOUNTTYPE}"`
          );
        }

        if (dataObj.TYPEOBJ.TYPEID !== TEST_ASSOCIATION_ID) {
          throw new Error(
            `TYPEOBJ.TYPEID mismatch: expected ${TEST_ASSOCIATION_ID}, got ${dataObj.TYPEOBJ.TYPEID}`
          );
        }

        if (!dataObj.DETAILS) {
          throw new Error("Missing DETAILS in dataObj");
        }

        // TEAMS and Grades may be empty arrays, which is OK
        if (!Array.isArray(dataObj.TEAMS)) {
          throw new Error("TEAMS must be an array");
        }

        this.log(`   Pseudo Account ID: ${dataObj.ACCOUNT.ACCOUNTID}`, "info");
        this.log(`   Association ID: ${dataObj.TYPEOBJ.TYPEID}`, "info");
        this.log(`   Teams Count: ${dataObj.TEAMS.length}`, "info");
        this.log(`   Grades Count: ${dataObj.Grades?.length || 0}`, "info");
      }
    );

    // Test 6: Invalid org type handling
    await this.test("fetchDataDirect() with invalid org type", async () => {
      try {
        await this.dataService.fetchDataDirect(TEST_CLUB_ID, "INVALID");
        throw new Error("Should have thrown an error for invalid org type");
      } catch (error) {
        if (!error.message.includes("Invalid org type")) {
          throw error;
        }
        // Expected error - test passes
        this.log(
          `   Correctly rejected invalid org type: ${error.message}`,
          "info"
        );
      }
    });

    // Test 7: Invalid org ID handling
    await this.test("fetchDataDirect() with invalid club ID", async () => {
      try {
        await this.dataService.fetchDataDirect(999999, "CLUB");
        // If it doesn't throw, the ID might actually exist - log a warning
        this.log(
          "   ⚠️  Warning: Invalid ID didn't throw error (may exist in CMS)",
          "info"
        );
      } catch (error) {
        // Expected error for invalid ID
        this.log(`   Correctly handled invalid ID: ${error.message}`, "info");
      }
    });

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${this.results.tests.length}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log("=".repeat(60) + "\n");

    if (this.results.failed > 0) {
      console.log("Failed Tests:");
      this.results.tests
        .filter((t) => t.status === "failed")
        .forEach((t) => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
      console.log("");
    }

    return this.results.failed === 0;
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new Phase2TestRunner();
  runner
    .runAllTests()
    .then((allPassed) => {
      if (allPassed) {
        console.log("🎉 All Phase 2 tests passed!");
        process.exit(0);
      } else {
        console.log("❌ Some Phase 2 tests failed. Review output above.");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ Fatal error during Phase 2 testing:", error);
      process.exit(1);
    });
}

module.exports = Phase2TestRunner;
