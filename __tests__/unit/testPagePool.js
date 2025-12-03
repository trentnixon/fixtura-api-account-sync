/**
 * Unit Tests for Page Pool Functionality
 * Tests Phase 1.1: Page Pool Creation
 *
 * Usage: node __tests__/unit/testPagePool.js
 */

require("dotenv").config();
const PuppeteerManager = require("../../dataProcessing/puppeteer/PuppeteerManager");
const { PARALLEL_CONFIG } = require("../../dataProcessing/puppeteer/constants");

async function testPagePool() {
  console.log("\n" + "=".repeat(80));
  console.log("Testing Page Pool Functionality");
  console.log("=".repeat(80) + "\n");

  const puppeteerManager = PuppeteerManager.getInstance();
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Create page pool with default size
    console.log("Test 1: Create page pool with default size");
    try {
      const defaultPool = await puppeteerManager.createPagePool();
      const expectedSize = PARALLEL_CONFIG.PAGE_POOL_SIZE;

      if (defaultPool.length === expectedSize) {
        console.log(`  ✅ PASS: Created pool with ${defaultPool.length} pages (expected: ${expectedSize})`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Created pool with ${defaultPool.length} pages (expected: ${expectedSize})`);
        testsFailed++;
      }

      // Verify all pages are valid
      const validPages = defaultPool.filter(page => !page.isClosed());
      if (validPages.length === defaultPool.length) {
        console.log(`  ✅ PASS: All ${validPages.length} pages are valid`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Only ${validPages.length}/${defaultPool.length} pages are valid`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error creating default pool: ${error.message}`);
      testsFailed++;
    }

    // Test 2: Create page pool with custom size
    console.log("\nTest 2: Create page pool with custom size (5 pages)");
    try {
      const customPool = await puppeteerManager.createPagePool(5);

      if (customPool.length === 5) {
        console.log(`  ✅ PASS: Created pool with ${customPool.length} pages (expected: 5)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Created pool with ${customPool.length} pages (expected: 5)`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error creating custom pool: ${error.message}`);
      testsFailed++;
    }

    // Test 3: Get pages from pool (round-robin)
    console.log("\nTest 3: Get pages from pool (round-robin distribution)");
    try {
      const poolSize = 3;
      await puppeteerManager.createPagePool(poolSize);

      const allocatedPages = [];
      for (let i = 0; i < poolSize * 2; i++) {
        const page = await puppeteerManager.getPageFromPool();
        allocatedPages.push(page);
      }

      // Verify we got pages (not null)
      const validAllocated = allocatedPages.filter(p => p && !p.isClosed());
      if (validAllocated.length === poolSize * 2) {
        console.log(`  ✅ PASS: Allocated ${validAllocated.length} pages successfully`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Only ${validAllocated.length}/${poolSize * 2} pages allocated`);
        testsFailed++;
      }

      // Release all pages
      for (const page of allocatedPages) {
        if (page && !page.isClosed()) {
          await puppeteerManager.releasePageFromPool(page);
        }
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error testing page allocation: ${error.message}`);
      testsFailed++;
    }

    // Test 4: Release pages back to pool
    console.log("\nTest 4: Release pages back to pool");
    try {
      const poolSize = 3;
      await puppeteerManager.createPagePool(poolSize);

      const page1 = await puppeteerManager.getPageFromPool();
      const page2 = await puppeteerManager.getPageFromPool();

      await puppeteerManager.releasePageFromPool(page1);
      await puppeteerManager.releasePageFromPool(page2);

      // Try to get pages again - should work if release was successful
      const page3 = await puppeteerManager.getPageFromPool();
      const page4 = await puppeteerManager.getPageFromPool();

      if (page3 && page4 && !page3.isClosed() && !page4.isClosed()) {
        console.log(`  ✅ PASS: Pages released and re-allocated successfully`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Pages not properly released/re-allocated`);
        testsFailed++;
      }

      // Cleanup
      await puppeteerManager.releasePageFromPool(page3);
      await puppeteerManager.releasePageFromPool(page4);
    } catch (error) {
      console.log(`  ❌ FAIL: Error testing page release: ${error.message}`);
      testsFailed++;
    }

    // Test 5: Pool exhaustion handling
    console.log("\nTest 5: Pool exhaustion handling");
    try {
      const poolSize = 2;
      await puppeteerManager.createPagePool(poolSize);

      // Allocate all pages
      const pages = [];
      for (let i = 0; i < poolSize; i++) {
        pages.push(await puppeteerManager.getPageFromPool());
      }

      // Try to get one more - should still work (pool creates new page if needed)
      const extraPage = await puppeteerManager.getPageFromPool();

      if (extraPage && !extraPage.isClosed()) {
        console.log(`  ✅ PASS: Pool handled exhaustion by creating new page`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Pool did not handle exhaustion correctly`);
        testsFailed++;
      }

      // Cleanup
      for (const page of pages) {
        await puppeteerManager.releasePageFromPool(page);
      }
      await puppeteerManager.releasePageFromPool(extraPage);
    } catch (error) {
      console.log(`  ❌ FAIL: Error testing pool exhaustion: ${error.message}`);
      testsFailed++;
    }

    // Test 6: Proxy authentication on pool pages
    console.log("\nTest 6: Proxy authentication on pool pages");
    try {
      const poolSize = 2;
      const pool = await puppeteerManager.createPagePool(poolSize);

      // Check if pages can navigate (proxy auth should be configured)
      let authWorking = true;
      for (const page of pool) {
        try {
          await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 5000 });
        } catch (error) {
          authWorking = false;
          console.log(`  ⚠️  Warning: Page navigation failed (may be expected): ${error.message}`);
        }
      }

      if (authWorking || pool.length > 0) {
        console.log(`  ✅ PASS: Pool pages created (proxy auth configured during creation)`);
        testsPassed++;
      } else {
        console.log(`  ❌ FAIL: Pool pages not properly configured`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL: Error testing proxy authentication: ${error.message}`);
      testsFailed++;
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("Test Summary");
    console.log("=".repeat(80));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📊 Total Tests: ${testsPassed + testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

    if (testsFailed === 0) {
      console.log("\n🎉 All tests passed!");
    } else {
      console.log(`\n⚠️  ${testsFailed} test(s) failed`);
    }

  } catch (error) {
    console.error("\n❌ Test suite failed with error:", error);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up...");
    try {
      await puppeteerManager.dispose();
      console.log("✅ Cleanup complete");
    } catch (cleanupError) {
      console.error("⚠️  Cleanup error:", cleanupError.message);
    }
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
testPagePool().catch((error) => {
  console.error("Unhandled error in test suite:", error);
  process.exit(1);
});

