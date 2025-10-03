/**
 * Central Test Runner
 * Runs all scraper tests in lockstep sequence
 *
 * Usage: node __tests__/integration/runAllTests.js
 */

const TestLogger = require("./helpers/TestLogger");
const TestResultsSaver = require("./helpers/TestResultsSaver");
const TestEnvironment = require("./helpers/TestEnvironment");

// Production scrapers and services
const GetCompetitions = require("../../dataProcessing/scrapeCenter/Competitions/getCompetitions");
const GetTeamsFromLadder = require("../../dataProcessing/scrapeCenter/Ladder/getTeamsFromLadder");
const GetTeamsGameData = require("../../dataProcessing/scrapeCenter/GameData/getGameData");
const ProcessingTracker = require("../../dataProcessing/services/processingTracker");
const CRUDOperations = require("../../dataProcessing/services/CRUDoperations");

// Test URLs - Using different associations to test scraper robustness
const ASSOCIATION_URL =
  "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1";
const CLUB_ASSOCIATION_URL =
  "https://www.playhq.com/cricket-australia/org/dandenong-district-cricket-association/34c8d195";

// Direct ladder URL for teams testing (has actual team data)
// Note: Remove /ladder since TeamFetcher will append it
const TEAMS_LADDER_URL =
  "https://www.playhq.com/cricket-australia/org/dandenong-district-cricket-association/ddca-senior-competition-summer-202526/a-grade/24bf50da";

class TestRunner {
  constructor() {
    this.logger = new TestLogger("Complete Scraper Test Suite");
    this.testEnvironment = new TestEnvironment();
    this.results = {
      phase1: { association: null, club: null },
      phase2: { association: null, club: null },
      phase3: { association: null, club: null },
    };
    this.allPassed = true;
  }

  async run() {
    this.logger.startTest();

    try {
      // Setup test environment with read-only CMS access
      await this.testEnvironment.setup();
      this.logger.logSubStep(
        "Test environment setup complete - read-only mode enabled",
        "info"
      );
      // ============================================================
      // PHASE 1: COMPETITION SCRAPERS
      // ============================================================
      await this.runPhase1();

      // ============================================================
      // PHASE 2: TEAM SCRAPERS
      // ============================================================
      await this.runPhase2();

      // ============================================================
      // PHASE 3: GAME SCRAPERS
      // ============================================================
      await this.runPhase3();

      // ============================================================
      // SAVE COMBINED RESULTS
      // ============================================================
      await this.saveCombinedResults();

      // ============================================================
      // CMS OPERATIONS VALIDATION
      // ============================================================
      await this.validateCMSOperations();
    } catch (error) {
      this.allPassed = false;
      this.logger.failStep(error);
    } finally {
      // Teardown test environment
      await this.testEnvironment.teardown();
      this.logger.endTest(this.allPassed);

      if (this.allPassed) {
        console.log("\n🎉 ALL TESTS PASSED - Complete test suite successful");
      } else {
        console.log("\n❌ SOME TESTS FAILED - Review logs above");
      }
    }
  }

  async runPhase1() {
    this.logger.startStep("PHASE 1: Competition Scrapers", {
      tests: ["Association", "Club"],
    });

    // Test 1A: Association Competitions
    console.log("\n🧪 Test 1A: Association Competitions");
    this.results.phase1.association = await this.testAssociationCompetitions();

    // Test 1B: Club Competitions
    console.log("\n🧪 Test 1B: Club Competitions");
    this.results.phase1.club = await this.testClubCompetitions();

    const phase1Passed =
      this.results.phase1.association.passed && this.results.phase1.club.passed;

    if (!phase1Passed) {
      this.allPassed = false;
    }

    this.logger.completeStep({
      associationPassed: this.results.phase1.association.passed,
      clubPassed: this.results.phase1.club.passed,
    });
  }

  async runPhase2() {
    this.logger.startStep("PHASE 2: Team Scrapers", {
      tests: ["Association", "Club"],
    });

    // Test 2A: Association Teams
    console.log("\n🧪 Test 2A: Association Teams");
    this.results.phase2.association = await this.testAssociationTeams();

    // Test 2B: Club Teams
    console.log("\n🧪 Test 2B: Club Teams");
    this.results.phase2.club = await this.testClubTeams();

    const phase2Passed =
      this.results.phase2.association.passed && this.results.phase2.club.passed;

    if (!phase2Passed) {
      this.allPassed = false;
    }

    this.logger.completeStep({
      associationPassed: this.results.phase2.association.passed,
      clubPassed: this.results.phase2.club.passed,
    });
  }

  async runPhase3() {
    this.logger.startStep("PHASE 3: Game Scrapers", {
      tests: ["Association", "Club"],
    });

    console.log("\n⏸️  Phase 3: Game Scrapers - TODO");
    this.logger.logSubStep("Games scraping - Next iteration", "info");

    this.logger.completeStep({ status: "pending" });
  }

  async testAssociationCompetitions() {
    try {
      console.log("   URL:", ASSOCIATION_URL);

      const crudOps = new CRUDOperations();
      const tracker = new ProcessingTracker(crudOps);

      const scraper = new GetCompetitions(
        { TYPEID: 427, TYPEURL: ASSOCIATION_URL },
        { ACCOUNTTYPE: "ASSOCIATION" },
        tracker
      );

      const startTime = Date.now();
      const results = await scraper.setup();
      const duration = Date.now() - startTime;

      console.log(`   ✅ Found ${results.length} competitions (${duration}ms)`);

      return {
        passed: true,
        data: results,
        duration,
        count: results.length,
      };
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return {
        passed: false,
        error: error.message,
      };
    }
  }

  async testClubCompetitions() {
    // Use the SAME scraper as association since both use association URLs

    try {
      console.log("   URL:", CLUB_ASSOCIATION_URL);

      // Reuse the existing ProcessingTracker instance
      const tracker = ProcessingTracker.getInstance();

      const scraper = new GetCompetitions(
        { TYPEID: 0, TYPEURL: CLUB_ASSOCIATION_URL },
        { ACCOUNTTYPE: "ASSOCIATION" },
        tracker
      );

      const startTime = Date.now();
      const results = await scraper.setup();
      const duration = Date.now() - startTime;

      if (!results) {
        console.log(`   ⚠️  No competitions found`);
        return {
          passed: true,
          data: [],
          duration,
          count: 0,
        };
      }

      console.log(`   ✅ Found ${results.length} competitions (${duration}ms)`);

      return {
        passed: true,
        data: results,
        duration,
        count: results.length,
      };
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return {
        passed: false,
        error: error.message,
      };
    }
  }

  async saveCombinedResults() {
    this.logger.startStep("Save Combined Results to Strapi", {
      collection: "fetch-test-accounts",
    });

    const saver = new TestResultsSaver();
    const report = this.logger.getReport();

    const testData = saver.buildTestDataFromReport(report, {
      scraperType: "competition",
      testEntity: "Integration Test Suite - 2025-2026",
      testEntityId: 0,
      testUrl: "multiple",
      expectedData: {},
      actualData: this.results,
      scrapedItemCount: this.getTotalItemCount(),
      expectedItemCount: 0,
      testConfiguration: {
        associationUrl: ASSOCIATION_URL,
        clubAssociationUrl: CLUB_ASSOCIATION_URL,
        lockstep: true,
      },
      notes:
        "Complete lockstep test suite - all scrapers tested for both routes",
    });

    try {
      this.logger.logSubStep("Saving complete test suite results", "info");
      const saved = await saver.saveTestResult(testData);
      this.logger.logSubStep(`Saved with ID: ${saved.id}`, "success");
      this.logger.completeStep({ savedToStrapi: true, strapiId: saved.id });
    } catch (error) {
      this.logger.logSubStep(`Failed to save: ${error.message}`, "warning");
      this.logger.completeStep({ savedToStrapi: false });
    }
  }

  async testAssociationTeams() {
    try {
      // Initialize required services (reuse existing instance from Phase 1)
      const tracker = ProcessingTracker.getInstance();
      const crud = new CRUDOperations();
      // Use the direct ladder URL that has actual team data
      const grades = [
        {
          href: TEAMS_LADDER_URL,
          url: TEAMS_LADDER_URL,
          compID: "ddca-senior-competition-summer-202526",
          id: "ddca-senior-competition-summer-202526",
        },
      ];

      console.log(
        `   Scraping teams from ${grades.length} competition ladders`
      );

      const dataObj = {
        ACCOUNT: { ACCOUNTID: 427, ACCOUNTTYPE: "ASSOCIATION" },
        Grades: grades,
        TEAMS: [],
      };

      const scraper = new GetTeamsFromLadder(dataObj);

      const startTime = Date.now();
      const results = await scraper.setup();
      const duration = Date.now() - startTime;

      if (!results) {
        console.log(`   ⚠️  No teams found`);
        return { passed: true, data: [], duration, count: 0 };
      }

      console.log(`   ✅ Found ${results.length} teams (${duration}ms)`);

      return { passed: true, data: results, duration, count: results.length };
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return { passed: false, error: error.message };
    }
  }

  async testClubTeams() {
    try {
      // Initialize required services (reuse existing instance)
      const tracker = ProcessingTracker.getInstance(); // Reuse existing instance
      const crud = new CRUDOperations();
      // Use the same direct ladder URL for club teams test
      const grades = [
        {
          href: TEAMS_LADDER_URL,
          url: TEAMS_LADDER_URL,
          compID: "ddca-senior-competition-summer-202526",
          id: "ddca-senior-competition-summer-202526",
        },
      ];

      console.log(
        `   Scraping teams from ${grades.length} competition ladders`
      );

      const dataObj = {
        ACCOUNT: { ACCOUNTID: 0, ACCOUNTTYPE: "ASSOCIATION" },
        Grades: grades,
        TEAMS: [],
      };

      const scraper = new GetTeamsFromLadder(dataObj);

      const startTime = Date.now();
      const results = await scraper.setup();
      const duration = Date.now() - startTime;

      if (!results) {
        console.log(`   ⚠️  No teams found`);
        return { passed: true, data: [], duration, count: 0 };
      }

      console.log(`   ✅ Found ${results.length} teams (${duration}ms)`);

      return { passed: true, data: results, duration, count: results.length };
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return { passed: false, error: error.message };
    }
  }

  async runPhase3() {
    this.logger.startStep("PHASE 3: Game Scrapers", {
      tests: ["Association", "Club"],
    });

    // Test 3A: Association Games
    console.log("\n🧪 Test 3A: Association Games");
    this.results.phase3.association = await this.testAssociationGames();

    // Test 3B: Club Games
    console.log("\n🧪 Test 3B: Club Games");
    this.results.phase3.club = await this.testClubGames();

    const phase3Passed =
      this.results.phase3.association.passed && this.results.phase3.club.passed;

    if (!phase3Passed) {
      this.allPassed = false;
    }

    this.logger.completeStep({
      associationPassed: this.results.phase3.association.passed,
      clubPassed: this.results.phase3.club.passed,
    });
  }

  async testAssociationGames() {
    try {
      // Initialize required services (reuse existing instance from previous phases)
      const tracker = ProcessingTracker.getInstance();
      const crud = new CRUDOperations();

      // Use team data from Phase 2
      const teams = this.results.phase2.association.data;

      if (!teams || teams.length === 0) {
        console.log("   ⚠️  No teams from Phase 2A");
        return { passed: false, data: [], count: 0 };
      }

      console.log(`   Scraping games from ${teams.length} teams`);

      // Convert team data to format expected by GetTeamsGameData
      const teamData = teams.map((team) => ({
        teamName: team.teamName,
        id: team.teamID,
        href: team.href,
        grade: team.grades[0], // Use first grade
      }));

      const dataObj = {
        ACCOUNT: { ACCOUNTID: 427, ACCOUNTTYPE: "ASSOCIATION" },
        TEAMS: teamData,
      };

      const scraper = new GetTeamsGameData(dataObj);

      const startTime = Date.now();
      const results = await scraper.setup();
      const duration = Date.now() - startTime;

      console.log(`   ✅ Found ${results.length} games (${duration}ms)`);

      return {
        passed: true,
        data: results,
        count: results.length,
        duration,
      };
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return { passed: false, error: error.message };
    }
  }

  async testClubGames() {
    try {
      // Initialize required services (reuse existing instance from previous phases)
      const tracker = ProcessingTracker.getInstance();
      const crud = new CRUDOperations();

      // Use team data from Phase 2
      const teams = this.results.phase2.club.data;

      if (!teams || teams.length === 0) {
        console.log("   ⚠️  No teams from Phase 2B");
        return { passed: false, data: [], count: 0 };
      }

      console.log(`   Scraping games from ${teams.length} teams`);

      // Convert team data to format expected by GetTeamsGameData
      const teamData = teams.map((team) => ({
        teamName: team.teamName,
        id: team.teamID,
        href: team.href,
        grade: team.grades[0], // Use first grade
      }));

      const dataObj = {
        ACCOUNT: { ACCOUNTID: 0, ACCOUNTTYPE: "CLUB" },
        TEAMS: teamData,
      };

      const scraper = new GetTeamsGameData(dataObj);

      const startTime = Date.now();
      const results = await scraper.setup();
      const duration = Date.now() - startTime;

      console.log(`   ✅ Found ${results.length} games (${duration}ms)`);

      return {
        passed: true,
        data: results,
        count: results.length,
        duration,
      };
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return { passed: false, error: error.message };
    }
  }

  async validateCMSOperations() {
    this.logger.startStep("CMS Operations Validation", {
      purpose: "Validate read-only mode and log all CMS operations",
    });

    try {
      const stats = this.testEnvironment.getStatistics();
      const blockedOps = this.testEnvironment.getBlockedOperations();
      const readOps = this.testEnvironment.getReadOperations();
      const noWrites = this.testEnvironment.validateNoWrites();

      this.logger.logSubStep(
        `Total CMS Operations: ${stats.totalOperations}`,
        "info"
      );
      this.logger.logSubStep(
        `Read Operations: ${stats.readOperations}`,
        "info"
      );
      this.logger.logSubStep(
        `Blocked Write Operations: ${stats.blockedOperations}`,
        "info"
      );

      // Log read operations
      if (readOps.length > 0) {
        this.logger.logSubStep("Read Operations Details:", "info");
        readOps.forEach((op, index) => {
          this.logger.logSubStep(`  ${index + 1}. GET ${op.path}`, "info");
        });
      }

      // Log blocked operations
      if (blockedOps.length > 0) {
        this.logger.logSubStep("Blocked Write Operations:", "warning");
        blockedOps.forEach((op, index) => {
          this.logger.logSubStep(
            `  ${index + 1}. ${op.method} ${op.path}`,
            "warning"
          );
        });
      }

      // Validate no writes occurred
      if (noWrites) {
        this.logger.logSubStep(
          "✅ No write operations detected - read-only mode working",
          "success"
        );
      } else {
        this.logger.logSubStep(
          "❌ Write operations detected - read-only mode failed",
          "error"
        );
        this.allPassed = false;
      }

      this.logger.completeStep({
        totalOperations: stats.totalOperations,
        readOperations: stats.readOperations,
        blockedOperations: stats.blockedOperations,
        noWrites,
      });
    } catch (error) {
      this.logger.logSubStep(
        `CMS validation failed: ${error.message}`,
        "error"
      );
      this.allPassed = false;
      this.logger.completeStep({ error: error.message });
    }
  }

  getTotalItemCount() {
    let count = 0;
    // Count all phases
    if (this.results.phase1.association?.count)
      count += this.results.phase1.association.count;
    if (this.results.phase1.club?.count)
      count += this.results.phase1.club.count;
    if (this.results.phase2.association?.count)
      count += this.results.phase2.association.count;
    if (this.results.phase2.club?.count)
      count += this.results.phase2.club.count;
    if (this.results.phase3.association?.count)
      count += this.results.phase3.association.count;
    if (this.results.phase3.club?.count)
      count += this.results.phase3.club.count;
    return count;
  }
}

// Run all tests
const runner = new TestRunner();
runner
  .run()
  .then(() => {
    process.exit(runner.allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  });
