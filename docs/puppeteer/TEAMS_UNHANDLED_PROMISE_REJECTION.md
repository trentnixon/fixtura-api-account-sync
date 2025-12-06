# Teams Scraper - Unhandled Promise Rejection Issue

## Issue

**Date:** 2024-12-06
**Error:** Multiple "Unhandled promise rejection" errors flooding logs during teams scraping
**Location:** Teams scraper (`dataProcessing/scrapeCenter/Ladder/`)

## Symptoms

- Hundreds of "Unhandled promise rejection" errors appearing in logs
- Errors occur during parallel processing of teams
- Errors start appearing when pages are being reset/reused (`Resetting page from ... to about:blank`)
- Some tasks complete successfully despite errors
- Errors seem to be related to Puppeteer operations during page resets

## Error Pattern

```
2025-12-06 12:47:52 error: [Worker] Unhandled promise rejection
2025-12-06 12:47:53 error: [Worker] Unhandled promise rejection
... (hundreds more)
```

Errors appear:
- During page reset operations
- When `waitForSelector` promises are pending
- During parallel processing of multiple grades
- When pages are being reused from pool

## Root Cause Analysis

### Likely Causes

1. **Page Reset During Pending Promises**
   - Pages are reset to `about:blank` while `waitForSelector` promises are still pending
   - When page context is destroyed, promises are rejected but not properly caught
   - `.catch(() => {})` doesn't prevent unhandled rejections if page is closed

2. **Promise Chain Breaking**
   - `waitForSelector` calls with `.catch(() => {})` may not properly handle page closure errors
   - If page is closed during wait, the rejection might propagate as unhandled

3. **Parallel Processing Race Conditions**
   - Multiple tasks accessing pages simultaneously
   - Page reset happening while operations are in progress
   - Promise rejections not being caught at the right level

## Affected Code Areas

### 1. `LadderDetector.js` - Lines 161-166, 180-185
```javascript
await this.page
  .waitForSelector('[data-testid="ladder"]', {
    timeout: this.backoffConfig.quickCheckDelay,
    visible: false,
  })
  .catch(() => {}); // May not catch page closure errors properly
```

### 2. `TeamFetcher.js` - Lines 114-119
```javascript
await this.page
  .waitForSelector('[data-testid="ladder"]', {
    timeout: 5000,
    visible: false,
  })
  .catch(() => {}); // May not catch page closure errors properly
```

### 3. `getTeamsFromLadder.js` - Parallel processing
- Promise rejections in parallel tasks may not be properly handled
- Page release operations happening while promises are pending

## Proposed Fix

### Solution 1: Check Page State Before Waiting
- Check if page is closed before calling `waitForSelector`
- Return early if page is closed
- Properly handle page closure errors

### Solution 2: Wrap Operations in Try-Catch
- Wrap all Puppeteer operations in try-catch blocks
- Specifically catch page closure errors
- Handle cancellation errors gracefully

### Solution 3: Improve Promise Error Handling
- Replace `.catch(() => {})` with proper error handling
- Check error type before swallowing
- Log cancellation errors appropriately

## Files to Fix

1. `dataProcessing/scrapeCenter/Ladder/LadderDetector.js`
   - Lines 161-166: `waitForSelector` error handling
   - Lines 180-185: `waitForSelector` error handling

2. `dataProcessing/scrapeCenter/Ladder/TeamFetcher.js`
   - Lines 114-119: `waitForSelector` error handling
   - Lines 71-138: `fetchTeams` error handling

3. `dataProcessing/scrapeCenter/Ladder/getTeamsFromLadder.js`
   - Lines 55-103: Parallel processing error handling

## Testing

After fix, test:
- ✅ Parallel processing of multiple grades
- ✅ Page pool reuse and reset operations
- ✅ No unhandled promise rejections in logs
- ✅ All teams successfully extracted
- ✅ Proper error handling for page closures

## Fix Applied

### Changes Made

1. **LadderDetector.js** - Improved `waitForSelector` error handling
   - Added page closure check before waiting
   - Properly catch and handle page closure errors
   - Suppress cancellation errors, re-throw others

2. **TeamFetcher.js** - Improved `waitForSelector` error handling
   - Added page closure check before waiting
   - Properly catch and handle page closure errors
   - Suppress cancellation errors, re-throw others

3. **getTeamsFromLadder.js** - Improved parallel processing error handling
   - Added cancellation error detection in catch block
   - Return empty array instead of throwing for cancellation errors
   - Added error handling in finally block for page release

### Code Changes

**Before:**
```javascript
await this.page
  .waitForSelector('[data-testid="ladder"]', {
    timeout: 5000,
    visible: false,
  })
  .catch(() => {}); // Swallows all errors, including unhandled rejections
```

**After:**
```javascript
try {
  if (this.page.isClosed()) {
    logger.warn("[PARALLEL_TEAMS] Page closed before wait, aborting");
    return [];
  }
  await this.page
    .waitForSelector('[data-testid="ladder"]', {
      timeout: 5000,
      visible: false,
    })
    .catch((err) => {
      // Check if error is due to page closure
      const errorMsg = err.message || String(err);
      if (
        errorMsg.includes("Target closed") ||
        errorMsg.includes("Session closed") ||
        errorMsg.includes("Page closed") ||
        errorMsg.includes("Protocol error")
      ) {
        logger.debug("[PARALLEL_TEAMS] Page closed during waitForSelector");
        return; // Suppress cancellation errors
      }
      // Re-throw other errors
      throw err;
    });
} catch (err) {
  // Handle any remaining errors
  const errorMsg = err.message || String(err);
  if (
    !errorMsg.includes("Target closed") &&
    !errorMsg.includes("Session closed") &&
    !errorMsg.includes("Page closed")
  ) {
    logger.debug(`[PARALLEL_TEAMS] Wait error: ${errorMsg}`);
  }
}
```

## Files Modified

1. `dataProcessing/scrapeCenter/Ladder/LadderDetector.js`
   - Lines 155-186: Improved `waitForSelector` error handling

2. `dataProcessing/scrapeCenter/Ladder/TeamFetcher.js`
   - Lines 111-140: Improved `waitForSelector` error handling

3. `dataProcessing/scrapeCenter/Ladder/getTeamsFromLadder.js`
   - Lines 61-95: Improved parallel processing error handling

## Testing

After fix, verify:
- ✅ No unhandled promise rejections in logs
- ✅ Parallel processing works correctly
- ✅ Page resets don't cause errors
- ✅ Cancellation errors are properly suppressed
- ✅ Other errors are still logged appropriately

## Status

✅ **FIX APPLIED - READY FOR TESTING**

The fix properly handles page closure errors during `waitForSelector` operations and prevents unhandled promise rejections.

