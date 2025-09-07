#!/usr/bin/env node

/**
 * Test script to diagnose API connection issues
 * Run with: node test-connection.js
 */

const dotenv = require("dotenv");
const ConnectionHealthCheck = require("./src/utils/connectionHealthCheck");
const { API_CONFIG } = require("./src/config/environment");

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log("🔍 Testing API Connection...\n");

  console.log("📋 Configuration:");
  console.log(`   Environment: ${process.env.NODE_ENV || "not set"}`);
  console.log(`   API URL: ${API_CONFIG.baseUrl}`);
  console.log(`   API Token: ${API_CONFIG.token ? "Set" : "Not set"}`);
  console.log(`   Timeout: ${API_CONFIG.timeout}ms`);
  console.log(`   Retry Attempts: ${API_CONFIG.retryAttempts}\n`);

  try {
    const healthCheck = new ConnectionHealthCheck();

    console.log("🏥 Running health check...");
    const isHealthy = await healthCheck.checkHealth();

    console.log(
      `\n📊 Health Check Result: ${isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`
    );

    if (!isHealthy) {
      console.log("\n⚠️  Connection Issues Detected:");
      const status = healthCheck.getStatus();
      console.log(`   Last Error: ${status.lastError || "None"}`);
      console.log(`   Last Check: ${status.lastCheck || "Never"}`);

      console.log("\n🔧 Troubleshooting Steps:");
      console.log("   1. Ensure your API server is running");
      console.log("   2. Check if the server is accessible at:", status.apiUrl);
      console.log("   3. Verify your .env file configuration");
      console.log("   4. Check network connectivity and firewall settings");

      // Try to wait for connection to become healthy
      console.log(
        "\n⏳ Waiting for connection to become healthy (30 seconds)..."
      );
      const becameHealthy = await healthCheck.waitForHealthy(30000, 2000);

      if (becameHealthy) {
        console.log("✅ Connection became healthy!");
      } else {
        console.log("❌ Connection did not become healthy within timeout");
      }
    } else {
      console.log("🎉 API connection is working correctly!");
    }
  } catch (error) {
    console.error("💥 Error during connection test:", error.message);
    console.error("\nStack trace:", error.stack);
  }
}

// Run the test
if (require.main === module) {
  testConnection()
    .then(() => {
      console.log("\n🏁 Connection test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Connection test failed:", error);
      process.exit(1);
    });
}

module.exports = { testConnection };
