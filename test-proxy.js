#!/usr/bin/env node

/**
 * Proxy Connection Test Utility
 * Tests proxy configuration and authentication
 * Run with: node test-proxy.js
 */

const dotenv = require("dotenv");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { PROXY_CONFIG } = require("./src/config/environment");
const {
  isProxyConfigValid,
  getProxyServerUrl,
  getProxyConfigDisplay,
} = require("./src/config/proxyConfig");
const logger = require("./src/utils/logger");

// Load environment variables
dotenv.config();

puppeteer.use(StealthPlugin());

async function testProxyConnection() {
  console.log("🔍 Testing Proxy Configuration...\n");

  // Check if proxy is configured
  console.log("📋 Proxy Configuration:");
  console.log(`   Enabled: ${PROXY_CONFIG.enabled ? "✅ Yes" : "❌ No"}`);
  console.log(`   Host: ${PROXY_CONFIG.host || "Not set"}`);
  console.log(
    `   Ports: ${
      PROXY_CONFIG.ports.length > 0 ? PROXY_CONFIG.ports.join(", ") : "Not set"
    }`
  );
  console.log(
    `   Username: ${
      PROXY_CONFIG.username
        ? `✅ Set (${PROXY_CONFIG.username.length} chars)`
        : "❌ Not set"
    }`
  );
  console.log(
    `   Password: ${
      PROXY_CONFIG.password
        ? `✅ Set (${PROXY_CONFIG.password.length} chars)`
        : "❌ Not set"
    }`
  );
  console.log(`   Display: ${getProxyConfigDisplay(PROXY_CONFIG)}\n`);

  // Validate credentials are not empty
  if (
    PROXY_CONFIG.enabled &&
    (!PROXY_CONFIG.username || !PROXY_CONFIG.password)
  ) {
    console.log("⚠️  WARNING: Proxy is enabled but credentials are missing!");
    console.log("   This will cause HTTP 407 errors.\n");
  }

  if (PROXY_CONFIG.enabled && PROXY_CONFIG.username && PROXY_CONFIG.password) {
    if (
      PROXY_CONFIG.username.trim() === "" ||
      PROXY_CONFIG.password.trim() === ""
    ) {
      console.log("⚠️  WARNING: Proxy credentials appear to be empty strings!");
      console.log("   This will cause HTTP 407 errors.\n");
    }
  }

  if (!isProxyConfigValid(PROXY_CONFIG)) {
    console.log("❌ Proxy configuration is invalid or disabled");
    console.log("\n🔧 To enable proxy, set in .env:");
    console.log("   DECODO_PROXY_ENABLED=true");
    console.log("   DECODO_PROXY_USERNAME=username");
    console.log("   DECODO_PROXY_PASSWORD=password");
    console.log(
      "\n💡 Note: Proxy host and ports are configured in src/config/proxyConfig.js"
    );
    console.log("   (Ports: 10001-10100, Host: dc.decodo.com)");
    return false;
  }

  // Test each proxy port
  const testResults = [];
  for (let i = 0; i < PROXY_CONFIG.ports.length; i++) {
    const port = PROXY_CONFIG.ports[i];

    // Do NOT include credentials in URL - use page.authenticate() instead (matches production)
    const proxyServer = getProxyServerUrl(PROXY_CONFIG.host, port);
    console.log(`\n🧪 Testing Proxy: ${PROXY_CONFIG.host}:${port}`);

    let browser = null;
    let proxyFailed = false;
    let proxyFailureReason = null;

    try {
      // Use the same launch options as production (getLegacyLaunchOptions)
      const {
        getLegacyLaunchOptions,
      } = require("./dataProcessing/puppeteer/browserConfig");
      const launchOptions = getLegacyLaunchOptions({
        headless: true,
        proxyServer,
      });

      console.log("   Launching browser with proxy...");
      browser = await puppeteer.launch(launchOptions);
      console.log("   ✅ Browser launched successfully");

      // Authenticate with proxy if needed (EXACTLY like dependencies.js - production code)
      if (proxyServer && PROXY_CONFIG.username && PROXY_CONFIG.password) {
        console.log("   Authenticating with proxy credentials...");
        console.log(
          `   Username: ${PROXY_CONFIG.username.substring(0, 3)}*** (${
            PROXY_CONFIG.username.length
          } chars)`
        );
        const pages = await browser.pages();
        if (pages.length > 0) {
          // EXACTLY like dependencies.js - no trimming, authenticate default page
          await pages[0].authenticate({
            username: PROXY_CONFIG.username,
            password: PROXY_CONFIG.password,
          });
          console.log("   ✅ Proxy authentication configured");
        }
      }

      // Get the default page (same as production)
      const pages = await browser.pages();
      const page = pages[0];

      // Test connection by navigating to a test page
      // IMPORTANT: Authentication must be set BEFORE navigation
      console.log("   Testing connection to https://httpbin.org/ip...");

      // Optional: Enable verbose debugging by setting DEBUG_PROXY=true
      const debugMode = process.env.DEBUG_PROXY === "true";
      if (debugMode) {
        // Add request/response listeners for debugging
        page.on("request", (request) => {
          console.log(`   🔍 Request: ${request.method()} ${request.url()}`);
        });
        page.on("response", (response) => {
          console.log(`   🔍 Response: ${response.status()} ${response.url()}`);
        });
        page.on("requestfailed", (request) => {
          console.log(
            `   ❌ Request failed: ${request.url()} - ${
              request.failure()?.errorText
            }`
          );
        });
      }

      try {
        const response = await page.goto("https://httpbin.org/ip", {
          waitUntil: "networkidle2",
          timeout: 15000,
        });

        if (response && response.status() === 200) {
          const content = await page.content();
          console.log("   ✅ Connection successful!");
          console.log(`   Status: ${response.status()}`);

          // Check for 407 error in response
          if (content.includes("407") || response.status() === 407) {
            console.log(
              "   ❌ HTTP 407 Proxy Authentication Required detected!"
            );
            proxyFailed = true;
            proxyFailureReason =
              "HTTP 407 - Proxy authentication failed (check credentials or quota)";
            testResults.push({
              port,
              success: false,
              error: proxyFailureReason,
            });
          } else {
            testResults.push({
              port,
              success: true,
              status: response.status(),
            });
          }
        } else {
          const status = response ? response.status() : "No response";
          console.log(`   ❌ Connection failed - Status: ${status}`);

          // Check if it's a proxy-related error
          if (status === 407 || status === 403 || status === 429) {
            proxyFailed = true;
            if (status === 407) {
              proxyFailureReason =
                "HTTP 407 - Proxy authentication failed (check credentials or quota)";
            } else if (status === 403) {
              proxyFailureReason =
                "HTTP 403 - Proxy access forbidden (check IP whitelist or quota)";
            } else if (status === 429) {
              proxyFailureReason =
                "HTTP 429 - Proxy rate limit exceeded (check quota)";
            }
          }

          testResults.push({
            port,
            success: false,
            error: `HTTP ${status}`,
          });
        }
      } catch (navError) {
        console.log(`   ❌ Navigation error: ${navError.message}`);

        // Check if it's a proxy-related error
        if (
          navError.message.includes("407") ||
          navError.message.includes("Proxy Authentication Required")
        ) {
          console.log("   ❌ HTTP 407 Proxy Authentication Required!");
          proxyFailed = true;
          proxyFailureReason =
            "HTTP 407 - Proxy authentication required (check credentials or quota)";
          testResults.push({
            port,
            success: false,
            error: proxyFailureReason,
          });
        } else if (
          navError.message.includes("403") ||
          navError.message.includes("Forbidden")
        ) {
          proxyFailed = true;
          proxyFailureReason =
            "HTTP 403 - Proxy access forbidden (check IP whitelist or quota)";
          testResults.push({
            port,
            success: false,
            error: proxyFailureReason,
          });
        } else if (
          navError.message.includes("429") ||
          navError.message.includes("rate limit")
        ) {
          proxyFailed = true;
          proxyFailureReason = "HTTP 429 - Proxy rate limit/quota exceeded";
          testResults.push({
            port,
            success: false,
            error: proxyFailureReason,
          });
        } else {
          testResults.push({
            port,
            success: false,
            error: navError.message,
          });
        }
      } finally {
        if (browser) {
          await browser.close();
          console.log("   Browser closed");
        }
      }

      // If proxy failed, test without proxy to verify it's a proxy issue
      if (proxyFailed && i === 0) {
        // Only test once without proxy
        console.log(
          "\n   ⚠️  Proxy test failed. Testing WITHOUT proxy to verify..."
        );
        try {
          const {
            getLegacyLaunchOptions,
          } = require("./dataProcessing/puppeteer/browserConfig");
          const noProxyOptions = getLegacyLaunchOptions({
            headless: true,
            proxyServer: null,
          });

          const noProxyBrowser = await puppeteer.launch(noProxyOptions);
          const noProxyPages = await noProxyBrowser.pages();
          const noProxyPage = noProxyPages[0];

          try {
            const noProxyResponse = await noProxyPage.goto(
              "https://httpbin.org/ip",
              {
                waitUntil: "networkidle2",
                timeout: 15000,
              }
            );

            if (noProxyResponse && noProxyResponse.status() === 200) {
              console.log("   ✅ Connection WITHOUT proxy works!");
              console.log(
                "   💡 This confirms the issue is with the proxy, not your network."
              );
              console.log(`   💡 Likely causes: ${proxyFailureReason}`);
              console.log(
                "   💡 Check: Proxy quota (0.1/0.1 GB used), IP whitelist, or credentials"
              );
            } else {
              console.log(
                `   ⚠️  Connection without proxy also failed: ${noProxyResponse?.status()}`
              );
            }
          } catch (noProxyError) {
            console.log(
              `   ⚠️  Connection without proxy failed: ${noProxyError.message}`
            );
          } finally {
            await noProxyBrowser.close();
          }
        } catch (noProxyLaunchError) {
          console.log(
            `   ⚠️  Could not test without proxy: ${noProxyLaunchError.message}`
          );
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      testResults.push({
        port,
        success: false,
        error: error.message,
      });

      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }
    }
  }

  // Summary
  console.log("\n📊 Test Results Summary:");
  console.log("=".repeat(50));

  const successful = testResults.filter((r) => r.success);
  const failed = testResults.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log(`\n✅ Successful: ${successful.length}/${testResults.length}`);
    successful.forEach((result) => {
      console.log(
        `   ${PROXY_CONFIG.host}:${result.port} - Status: ${result.status}`
      );
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${testResults.length}`);
    failed.forEach((result) => {
      console.log(`   ${PROXY_CONFIG.host}:${result.port} - ${result.error}`);
    });
  }

  // Recommendations
  if (failed.length > 0) {
    console.log("\n🔧 Troubleshooting Steps:");

    const has407 = failed.some((r) => r.error.includes("407"));
    if (has407) {
      console.log(
        "   1. ❌ HTTP 407 Error Detected - Proxy Authentication Issue"
      );
      console.log("      - Verify DECODO_PROXY_USERNAME is correct");
      console.log("      - Verify DECODO_PROXY_PASSWORD is correct");
      console.log("      - Check if proxy credentials have changed");
      console.log("      - Ensure credentials are properly set in .env file");
    }

    const hasNoAuth = failed.some(
      (r) => r.error.includes("authentication") && !r.error.includes("407")
    );
    if (hasNoAuth) {
      console.log("   2. ⚠️  Authentication may not be working");
      console.log("      - Check if page.authenticate() is being called");
      console.log("      - Verify authentication happens before navigation");
    }

    const hasConnection = failed.some(
      (r) => r.error.includes("ECONNREFUSED") || r.error.includes("timeout")
    );
    if (hasConnection) {
      console.log("   3. ⚠️  Connection Issues");
      console.log("      - Verify proxy server is accessible");
      console.log("      - Check network connectivity");
      console.log("      - Verify proxy host and port are correct");
    }
  }

  return successful.length > 0;
}

// Run the test
if (require.main === module) {
  testProxyConnection()
    .then((success) => {
      console.log(
        `\n🏁 Proxy test ${success ? "completed successfully" : "found issues"}`
      );
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("\n💥 Proxy test failed:", error);
      process.exit(1);
    });
}

module.exports = { testProxyConnection };
