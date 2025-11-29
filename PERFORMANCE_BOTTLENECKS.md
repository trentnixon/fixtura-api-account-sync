# Performance Bottlenecks Analysis

**Date:** 2025-11-29
**Context:** Performance regression investigation - 3x slowdown detected
**Current Performance:** 6-9 seconds per page operation

---

## Executive Summary

**Primary Issue:** The memory check optimization in `PuppeteerManager` is working correctly, but the actual page processing operations are taking 6-9 seconds per page, which is the root cause of the 3x performance regression.

**Key Findings:**

- ✅ Memory check optimization working (checks only every 10 operations)
- ✅ **Navigation timeouts** - Reduced from 30s to 15s (COMPLETED)
- ✅ **Unnecessary wait delays** - Replaced with proper waits or reduced (COMPLETED)
- ✅ **Retry logic** - Exponential backoff + early exit for non-retryable errors (COMPLETED)
- ❌ **LadderDetector backoff strategy** - 2-15+ seconds per page (CRITICAL)

---

## Critical Bottlenecks (High Priority)

### 1. LadderDetector Backoff Strategy ⚠️ **CRITICAL**

**Location:** `dataProcessing/scrapeCenter/Ladder/LadderDetector.js`

**Issue:** Complex backoff strategy with multiple wait attempts that can take 2-15+ seconds per page.

**Current Behavior:**

- First attempt: 200ms-1500ms quick check (depending on strategy)
- Subsequent attempts: 500ms-3000ms initial delay, increasing with backoff multiplier
- Up to 3-5 attempts (depending on strategy)
- Each attempt includes `waitForTimeout()` calls

**Impact:**

- **Balanced strategy (default):** 1s quick check + 2s + 3.6s + 6.48s = **~13 seconds worst case**
- **Conservative strategy:** 1.5s + 3s + 6s + 12s = **~22.5 seconds worst case**
- This is called for EVERY team ladder page

**Code References:**

```javascript
// Line 116: Quick check delay
await this.page.waitForTimeout(this.backoffConfig.quickCheckDelay); // 200ms-1500ms

// Line 119: Backoff delays
await this.page.waitForTimeout(currentDelay); // 500ms-3000ms, increasing

// Line 155-157: Exponential backoff
currentDelay = Math.min(
  currentDelay * this.backoffConfig.backoffMultiplier, // 1.5-2.0x
  this.backoffConfig.maxDelay // 5s-20s
);
```

**Recommendation:**

1. **Immediate:** Switch to "fast" or "aggressive" strategy for production
2. **Optimize:** Reduce initial delays and max attempts
3. **Alternative:** Use `waitForSelector` with shorter timeout instead of multiple backoff attempts

**Estimated Impact:** 50-70% reduction in ladder processing time

---

### 2. Long Navigation Timeouts ⚠️ **HIGH** ✅ **COMPLETED**

**Location:** Multiple files

**Issue:** Navigation timeouts set to 30 seconds, causing slow failures.

**Files Affected:**

- `GameDataFetcher.js` (line 153): `timeout: 30000`
- `PuppeteerManager.js` (constants): `navigationTimeout: 30000`
- `AssociationCompetitionsFetcher.js` (line 29): No timeout specified (uses default 30s)

**Impact:**

- If a page is slow to load, waits up to 30 seconds before timing out
- Network issues cause 30-second delays instead of failing fast

**Recommendation:**

1. Reduce navigation timeout to 10-15 seconds for faster failure detection
2. Add explicit timeout to `AssociationCompetitionsFetcher.navigateToUrl()`
3. Consider different timeouts for different operations (competitions vs games)

**Estimated Impact:** 20-40% faster failure detection on slow pages

**✅ Status: COMPLETED (2025-11-29)**

**Changes Made:**

- ✅ `GameDataFetcher.js`: Reduced timeout from 30000ms to 15000ms (15 seconds)
- ✅ `constants.js`: Reduced `PAGE_CONFIG.navigationTimeout` from 30000ms to 15000ms
- ✅ `AssociationCompetitionsFetcher.js`: Added explicit timeout (15000ms) and `waitUntil: "domcontentloaded"`
- ✅ `TeamFetcher.js`: Added explicit timeout (15000ms) and `waitUntil: "domcontentloaded"`
- ✅ All navigation calls now use consistent 15-second timeout for faster failure detection

---

### 3. Unnecessary Wait Delays After Navigation ⚠️ **HIGH** ✅ **COMPLETED**

**Location:** Multiple files

**Issue:** Fixed delays after navigation that may not be necessary.

**Files Affected:**

1. **fixtureValidationService.js (line 112):**

   ```javascript
   await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds
   ```

   - Waits 3 seconds after navigation "for SPA to render"
   - This is called for EVERY fixture validation

2. **GameDataFetcher.js (line 172):**

   ```javascript
   await new Promise((res) => setTimeout(res, 2000)); // 2 seconds
   ```

   - 2-second delay between retry attempts

3. **api/Puppeteer/NoClubAssociations/getTeamsGameData.js (line 206):**
   ```javascript
   await this.page.waitForTimeout(1000); // 1 second
   ```
   - 1-second delay after waiting for selector

**Impact:**

- 3 seconds × number of fixtures = significant cumulative delay
- These delays may be unnecessary if using proper `waitForSelector` or `waitForFunction`

**Recommendation:**

1. Replace fixed delays with proper `waitForSelector` or `waitForFunction` calls
2. If delays are necessary, reduce to 500ms-1000ms maximum
3. Test if delays can be removed entirely

**Estimated Impact:** 30-50% reduction in processing time for affected operations

**✅ Status: COMPLETED (2025-11-29)**

**Changes Made:**

- ✅ `fixtureValidationService.js`: Replaced 3s fixed delay with `waitForFunction` that checks for body content (returns immediately when content available, max 2s timeout + 500ms fallback)
- ✅ `GameDataFetcher.js`: Reduced retry delay from 2000ms to 1000ms (50% reduction)
- ✅ `getTeamsGameData.js`: Replaced 1s fixed delay with `waitForSelector` for gradeId button (waits for actual element instead of arbitrary delay)
- ✅ All delays now use proper async waits or are significantly reduced

---

## Moderate Bottlenecks

### 4. Retry Logic with Fixed Delays ✅ **COMPLETED**

**Location:** `GameDataFetcher.js` (line 147-174)

**Issue:** Navigation retry logic with 2-second delays between attempts.

**Current Behavior:**

- Up to 3 retry attempts
- 2-second delay between each retry
- 30-second timeout per attempt

**Impact:**

- If navigation fails, adds 2-4 seconds of delay
- Combined with 30s timeout, can add significant time

**Recommendation:**

- Reduce retry delay to 500ms-1000ms
- Consider exponential backoff instead of fixed delay
- Add early exit if error is not retryable (e.g., 404)

**Estimated Impact:** 10-20% faster retry handling

**✅ Status: COMPLETED (2025-11-29)**

**Changes Made:**

- ✅ Implemented exponential backoff: 500ms → 750ms → 1125ms (instead of fixed 1s)
- ✅ Added early exit for non-retryable errors (404, DNS failures, invalid URLs, browser disconnects)
- ✅ Faster first retry: 500ms instead of 1000ms (50% faster)
- ✅ Better error detection: Skips retries for errors that will never succeed
- ✅ Improved logging: Shows retry delay and reason for skipping retries

**Performance Impact:**

- **Non-retryable errors:** Immediate exit (saves 1-2 seconds per failed navigation)
- **Retryable errors:** Faster first retry (500ms vs 1000ms) with exponential backoff
- **Overall:** 15-25% faster retry handling, especially for 404s and DNS failures

---

### 5. Missing Timeout Configurations ✅ **COMPLETED**

**Location:** `AssociationCompetitionsFetcher.js` (line 29)

**Issue:** `page.goto()` called without explicit timeout, uses default 30 seconds.

**Code:**

```javascript
async navigateToUrl() {
  await this.page.goto(this.url); // No timeout specified
}
```

**Impact:**

- Uses default 30-second timeout
- No control over timeout behavior

**Recommendation:**

- Add explicit timeout: `await this.page.goto(this.url, { timeout: 15000, waitUntil: "domcontentloaded" })`

**Estimated Impact:** 5-10% improvement in competitions fetching

**✅ Status: COMPLETED (2025-11-29)**

**Changes Made:**

- ✅ `AssociationCompetitionsFetcher.js`: Added explicit timeout (15000ms) and `waitUntil: "domcontentloaded"`
- ✅ This was completed as part of the navigation timeout optimization (Section 2)
- ✅ All navigation calls now have explicit timeout configurations

---

### 6. Multiple Selector Wait Attempts

**Location:** `GameDataFetcher.js` (line 177-228)

**Issue:** Tries multiple selectors sequentially, each with 5-second timeout.

**Current Behavior:**

- Tries 4 different selectors in sequence
- Each has 5-second timeout
- Worst case: 20 seconds if all fail

**Impact:**

- If first selector fails, waits 5 seconds before trying next
- Can add 5-15 seconds of unnecessary waiting

**Recommendation:**

- Use `Promise.race()` to try multiple selectors simultaneously
- Or reduce timeout per selector to 2-3 seconds
- Add early exit if first selector succeeds

**Estimated Impact:** 10-15% faster page load detection

---

## Minor Optimizations

### 7. Small Delays in Batch Processing

**Location:** Multiple files

**Issue:** Small delays between batch operations that may be unnecessary.

**Files:**

- `fixtureValidationService.js` (line 559): 100ms delay
- `GameCrud.js` (line 392): 100ms delay
- `fixtureDeletionService.js` (line 194): 500ms delay

**Impact:** Minimal, but adds up over many operations

**Recommendation:** Review if delays are necessary or can be reduced

---

### 8. Page Structure Monitoring Overhead

**Location:** `TeamFetcher.js` (line 89-128)

**Issue:** Page structure monitoring adds overhead to every team fetch.

**Impact:** Minimal, but adds logging and analysis time

**Recommendation:** Consider making structure monitoring optional or async

---

## Performance Metrics from Logs

Based on the provided logs:

- **Op 20 → Op 30:** 87 seconds (8.7s per page)
- **Op 30 → Op 40:** 69 seconds (6.9s per page)
- **Average:** ~7.8 seconds per page operation

**Breakdown Estimate:**

- Page creation: ~0.5s
- Navigation: ~1-2s
- Wait for content: ~2-5s (LadderDetector backoff)
- Content extraction: ~0.5-1s
- Delays: ~1-3s (fixed waits)

---

## Recommendations Priority

### Immediate Actions (High Impact, Low Risk)

1. **Switch LadderDetector to "fast" strategy**

   - Change `SCRAPER_BACKOFF_STRATEGY=fast` in environment
   - Or modify default in `backoffConfig.js`

2. ✅ **Reduce navigation timeouts** - **COMPLETED**

   - ✅ Changed from 30s to 15s across all navigation calls
   - ✅ Added explicit timeout to `AssociationCompetitionsFetcher`
   - ✅ Added explicit timeout to `TeamFetcher`
   - ✅ Updated default in `constants.js`

3. ✅ **Remove or reduce fixed delays** - **COMPLETED**

   - ✅ Replaced 3s delay in `fixtureValidationService` with `waitForFunction`
   - ✅ Replaced 1s delay in `getTeamsGameData` with `waitForSelector`

4. ✅ **Optimize retry logic** - **COMPLETED**
   - ✅ Implemented exponential backoff (500ms → 750ms → 1125ms) in `GameDataFetcher`
   - ✅ Added early exit for non-retryable errors (404, DNS failures, invalid URLs)
   - ✅ Faster first retry (500ms vs previous 1000ms)
   - ✅ Better error detection to skip retries for errors that will never succeed

### Short-term Actions (Medium Impact)

4. **Optimize LadderDetector backoff**

   - Reduce initial delays
   - Use `waitForSelector` instead of multiple `waitForTimeout` calls

5. **Optimize selector waiting**
   - Use `Promise.race()` for multiple selectors
   - Reduce per-selector timeouts

### Long-term Actions (Lower Priority)

6. **Review and optimize all delays**

   - Audit all `setTimeout` and `waitForTimeout` calls
   - Replace with proper async waits where possible

7. **Add performance monitoring**
   - Track time per operation type
   - Identify slowest operations

---

## Expected Performance Improvement

**Current:** ~7.8 seconds per page operation

**After Optimizations:**

- ✅ Timeout reduction: -1-2 seconds (COMPLETED)
- ✅ Delay removal/optimization: -1-2 seconds (COMPLETED)
- ⏳ LadderDetector optimization: -3-5 seconds (PENDING)
- **Current Target:** ~4-5 seconds per page operation (with completed optimizations)
- **Final Target:** ~2-3 seconds per page operation (after LadderDetector fix)

**Overall Improvement:**

- **Completed optimizations:** 25-35% faster processing
- **With all optimizations:** 60-70% faster processing

---

## Files Requiring Changes

### High Priority

1. `dataProcessing/scrapeCenter/Ladder/LadderDetector.js`
2. `dataProcessing/scrapeCenter/Ladder/backoffConfig.js`
3. `dataProcessing/services/fixtureValidationService.js`
4. `dataProcessing/scrapeCenter/GameData/GameDataFetcher.js`
5. `dataProcessing/scrapeCenter/Competitions/AssociationCompetitionsFetcher.js`

### Medium Priority

6. `dataProcessing/puppeteer/constants.js`
7. `api/Puppeteer/NoClubAssociations/getTeamsGameData.js`

### Low Priority

8. `dataProcessing/assignCenter/games/GameCrud.js`
9. `dataProcessing/services/fixtureDeletionService.js`

---

## Testing Recommendations

1. **Before changes:** Measure baseline performance (time per operation)
2. **After each change:** Measure impact individually
3. **Monitor logs:** Use `[PERF]` prefix to track performance
4. **Test scenarios:**
   - Single page processing
   - Batch processing (10+ pages)
   - Error scenarios (timeouts, failures)

---

## Notes

- The memory check optimization in `PuppeteerManager` is working correctly
- The performance issue is in the actual scraping operations, not page creation
- LadderDetector backoff strategy is the single biggest bottleneck
- Multiple small delays add up to significant cumulative time

---

**Last Updated:** 2025-11-29
**Status:** Analysis Complete - Ready for Implementation
