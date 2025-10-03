/**
 * Test Logger
 * Provides detailed logging for integration test execution
 */

class TestLogger {
  constructor(testName) {
    this.testName = testName;
    this.steps = [];
    this.startTime = null;
    this.endTime = null;
    this.currentStep = null;
  }

  /**
   * Start the test
   */
  startTest() {
    this.startTime = new Date();
    console.log("\n" + "=".repeat(80));
    console.log(`🧪 TEST: ${this.testName}`);
    console.log(`⏰ Started at: ${this.startTime.toISOString()}`);
    console.log("=".repeat(80) + "\n");
  }

  /**
   * Start a test step
   * @param {string} stepName - Name of the step
   * @param {Object} details - Additional details
   */
  startStep(stepName, details = {}) {
    this.currentStep = {
      name: stepName,
      status: "in_progress",
      startTime: new Date(),
      endTime: null,
      duration: null,
      details: details,
      subSteps: [],
      errors: [],
    };

    console.log(`\n📍 STEP: ${stepName}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
    console.log(`   Status: ⏳ In Progress...`);
  }

  /**
   * Log a sub-step within the current step
   * @param {string} message - Sub-step message
   * @param {string} type - Type: info, success, warning, error
   */
  logSubStep(message, type = "info") {
    if (!this.currentStep) {
      console.log(`   ${this.getIcon(type)} ${message}`);
      return;
    }

    this.currentStep.subSteps.push({
      message,
      type,
      timestamp: new Date(),
    });

    console.log(`   ${this.getIcon(type)} ${message}`);
  }

  /**
   * Log data for inspection
   * @param {string} label - Data label
   * @param {*} data - Data to log
   */
  logData(label, data) {
    console.log(`\n   📊 ${label}:`);
    console.log(`   ${JSON.stringify(data, null, 2).replace(/\n/g, "\n   ")}`);
  }

  /**
   * Complete the current step successfully
   * @param {Object} result - Result data
   */
  completeStep(result = {}) {
    if (!this.currentStep) return;

    this.currentStep.status = "passed";
    this.currentStep.endTime = new Date();
    this.currentStep.duration =
      this.currentStep.endTime - this.currentStep.startTime;
    this.currentStep.result = result;

    console.log(`   Status: ✅ Passed (${this.currentStep.duration}ms)`);

    this.steps.push(this.currentStep);
    this.currentStep = null;
  }

  /**
   * Fail the current step
   * @param {Error} error - Error that caused failure
   */
  failStep(error) {
    if (!this.currentStep) return;

    this.currentStep.status = "failed";
    this.currentStep.endTime = new Date();
    this.currentStep.duration =
      this.currentStep.endTime - this.currentStep.startTime;
    this.currentStep.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
    });

    console.log(`   Status: ❌ Failed (${this.currentStep.duration}ms)`);
    console.log(`   Error: ${error.message}`);

    this.steps.push(this.currentStep);
    this.currentStep = null;
  }

  /**
   * End the test
   * @param {boolean} passed - Whether test passed overall
   */
  endTest(passed = true) {
    this.endTime = new Date();
    const totalDuration = this.endTime - this.startTime;

    console.log("\n" + "=".repeat(80));
    console.log(`📊 TEST SUMMARY: ${this.testName}`);
    console.log("=".repeat(80));

    // Overall status
    const overallStatus = passed ? "✅ PASSED" : "❌ FAILED";
    console.log(`\n   Overall Status: ${overallStatus}`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Completed at: ${this.endTime.toISOString()}`);

    // Step summary
    const passedSteps = this.steps.filter((s) => s.status === "passed").length;
    const failedSteps = this.steps.filter((s) => s.status === "failed").length;

    console.log(`\n   Steps: ${this.steps.length} total`);
    console.log(`   ✅ Passed: ${passedSteps}`);
    console.log(`   ❌ Failed: ${failedSteps}`);

    // Detailed step breakdown
    console.log(`\n   Step Breakdown:`);
    this.steps.forEach((step, index) => {
      const icon = step.status === "passed" ? "✅" : "❌";
      console.log(`   ${index + 1}. ${icon} ${step.name} (${step.duration}ms)`);

      if (step.errors.length > 0) {
        step.errors.forEach((error) => {
          console.log(`      ⚠️  Error: ${error.message}`);
        });
      }
    });

    // Failed steps detail
    if (failedSteps > 0) {
      console.log(`\n   ❌ Failed Steps Detail:`);
      this.steps
        .filter((s) => s.status === "failed")
        .forEach((step) => {
          console.log(`\n   Step: ${step.name}`);
          step.errors.forEach((error) => {
            console.log(`   Error: ${error.message}`);
            console.log(`   Stack: ${error.stack}`);
          });
        });
    }

    console.log("\n" + "=".repeat(80) + "\n");
  }

  /**
   * Get icon for log type
   * @param {string} type - Log type
   * @returns {string} Icon
   */
  getIcon(type) {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      data: "📊",
      time: "⏱️",
      check: "🔍",
    };
    return icons[type] || "•";
  }

  /**
   * Log a validation check
   * @param {string} field - Field being validated
   * @param {boolean} passed - Whether validation passed
   * @param {*} expected - Expected value
   * @param {*} actual - Actual value
   */
  logValidation(field, passed, expected, actual) {
    const icon = passed ? "✅" : "❌";
    const status = passed ? "PASS" : "FAIL";

    console.log(`   ${icon} Validation [${status}]: ${field}`);
    if (!passed) {
      console.log(`      Expected: ${JSON.stringify(expected)}`);
      console.log(`      Actual: ${JSON.stringify(actual)}`);
    }
  }

  /**
   * Log performance metric
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Unit of measurement
   */

  /**
   * Get test report
   * @returns {Object} Test report
   */
  getReport() {
    const endTime = this.endTime || new Date();
    const duration = endTime - this.startTime;

    return {
      testName: this.testName,
      startTime: this.startTime,
      endTime: endTime,
      duration: duration,
      totalSteps: this.steps.length,
      passedSteps: this.steps.filter((s) => s.status === "passed").length,
      failedSteps: this.steps.filter((s) => s.status === "failed").length,
      steps: this.steps,
      passed: this.steps.every((s) => s.status === "passed"),
    };
  }

  /**
   * Export report to JSON file
   * @param {string} filepath - File path to save report
   */
  exportReport(filepath) {
    const fs = require("fs");
    const report = this.getReport();
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test report saved to: ${filepath}`);
  }
}

module.exports = TestLogger;
