const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

class IntegrationTestRunner {
  constructor() {
    this.projectDir = path.resolve(__dirname, "../..");
    this.logDir = path.join(__dirname, "logs");
    this.isRunning = false;

    // Ensure logs directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);

    // Also write to daily log file
    const today = new Date().toISOString().split("T")[0];
    const logFile = path.join(this.logDir, `cron-${today}.log`);
    fs.appendFileSync(logFile, logMessage + "\n");
  }

  async runIntegrationTests() {
    if (this.isRunning) {
      this.log(
        "⚠️  Integration tests already running, skipping this execution"
      );
      return;
    }

    this.isRunning = true;
    this.log("🚀 Starting daily integration test suite...");

    return new Promise((resolve) => {
      const testCommand = `node ${path.join(__dirname, "runAllTests.js")}`;

      this.log(`📋 Executing: ${testCommand}`);
      this.log(`📁 Working directory: ${this.projectDir}`);

      const childProcess = exec(testCommand, {
        cwd: this.projectDir,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
      });

      let output = "";
      let errorOutput = "";

      childProcess.stdout.on("data", (data) => {
        output += data;
        // Log real-time output
        process.stdout.write(data);
      });

      childProcess.stderr.on("data", (data) => {
        errorOutput += data;
        // Log real-time errors
        process.stderr.write(data);
      });

      childProcess.on("close", (code) => {
        this.isRunning = false;

        if (code === 0) {
          this.log("✅ Daily integration test suite completed successfully");
          this.log("🎉 All tests passed - scraper functionality validated");
        } else {
          this.log(
            `❌ Daily integration test suite failed with exit code: ${code}`
          );
          this.log("🔍 Check the output above for error details");
        }

        // Log summary
        this.log(`📊 Test execution completed at ${new Date().toISOString()}`);
        this.log("----------------------------------------");

        resolve(code);
      });

      childProcess.on("error", (error) => {
        this.isRunning = false;
        this.log(`💥 Failed to start integration tests: ${error.message}`);
        resolve(1);
      });
    });
  }

  startRunner() {
    this.log("⏰ Starting integration test runner...");
    this.log("🚀 Running tests immediately on startup...");

    // Run tests immediately on startup
    this.runIntegrationTests();

    this.log("✅ Integration test runner started successfully");
    this.log("🎯 Tests will run once on startup - no scheduled execution");
  }

  // Method to run tests immediately (for testing)
  async runNow() {
    this.log("🔧 Manual trigger - running integration tests now");
    await this.runIntegrationTests();
  }

  // Method to stop the runner
  stop() {
    this.log("🛑 Stopping integration test runner...");
    process.exit(0);
  }
}

// Only auto-start if this file is run directly
if (require.main === module) {
  // Create and start the runner
  const runner = new IntegrationTestRunner();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    runner.log("🛑 Received SIGINT, shutting down gracefully...");
    runner.stop();
  });

  process.on("SIGTERM", () => {
    runner.log("🛑 Received SIGTERM, shutting down gracefully...");
    runner.stop();
  });

  // Start the runner
  runner.startRunner();
}

// Export for potential programmatic use
module.exports = IntegrationTestRunner;
