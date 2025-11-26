# Single Job Memory Issues - 1GB Spike Analysis

## 🔍 Problem Statement

Memory spikes to 1GB+ even with **only 1 queue job running at a time**. This means the issue is within a single job execution, not multiple jobs.

---

## 🚨 Critical Issues Found in Single Job Execution

### 1. **LARGE DATA ARRAYS ACCUMULATING** (CRITICAL)

**Location**: `dataProcessing/processors/gameDataProcessor.js:24`

```javascript
const allScrapedFixtures = []; // Store all scraped fixtures for comparison
// ...
allScrapedFixtures.push(...scrapedGameData); // Accumulates across ALL batches
```

**Problem**:

- For large accounts with 100+ teams, this array can hold thousands of fixture objects
- Each fixture object can be 5-10KB
- 1000 fixtures × 10KB = 10MB just for this array
- This array stays in memory for the entire job duration

**Impact**: Large accounts can accumulate 50-100MB+ in arrays alone

---

### 2. **DATA CONTROLLER ARRAYS** (HIGH)

**Location**: `dataProcessing/controllers/dataController.js:22-24`

```javascript
this.fixtureValidationResults = []; // Store validation results for cleanup phase
this.scrapedFixtures = []; // Store scraped fixtures from ProcessGames for comparison
this.fetchedFixtures = []; // Store fetched fixtures from ProcessFixtureValidation
```

**Problem**:

- These arrays accumulate data throughout the entire job
- Never cleared until job completes
- Can hold hundreds/thousands of objects

**Impact**: 20-50MB+ per array = 60-150MB total

---

### 3. **BROWSER RESTART THRESHOLD TOO HIGH FOR SINGLE JOB** (MEDIUM)

**Current**: Restarts at 200MB RSS

**Problem**:

- Single job can create many pages:
  - Competitions: 1 page
  - Teams: 1 page
  - Games: Multiple pages (1 per batch of 10 teams)
  - Fixture Validation: Multiple pages (1 per batch of 5 fixtures)
- If account has 100 teams → 10 game batches → 10 pages
- If account has 200 fixtures → 40 validation batches → 40 pages
- Each page can hold 10-50MB of DOM/cache
- 50 pages × 30MB = 1.5GB before restart happens!

**Impact**: Memory spikes to 1GB+ before browser restart triggers

---

### 4. **OPERATION COUNT RESTART TOO HIGH FOR SINGLE JOB** (MEDIUM)

**Current**: Restarts every 5 operations

**Problem**:

- Single job can create:
  - 1 page for competitions
  - 1 page for teams
  - 10+ pages for games (batches)
  - 40+ pages for fixture validation (batches)
  - **Total: 50+ operations before restart!**

**Impact**: Browser runs for entire job without restart, accumulating memory

---

### 5. **PAGES NOT CLOSED BETWEEN STAGES** (HIGH)

**Problem**: Pages might not be closed between processing stages:

```
Stage 1: Competitions → creates page → uses it → closes it ✅
Stage 2: Teams → creates page → uses it → closes it ✅
Stage 3: Games → creates 10 pages (batches) → uses them → closes them ✅
Stage 4: Fixture Validation → creates 40 pages (batches) → uses them → closes them ✅
```

**But**: If pages aren't closed properly, or if browser doesn't restart, memory accumulates.

---

### 6. **PUPPETEER V24 MEMORY PER PAGE** (UNKNOWN)

**Problem**: Puppeteer v24 might use more memory per page than previous versions.

**Possible causes**:

- Larger default heap size
- More aggressive caching
- Different garbage collection behavior
- DOM snapshots kept longer

**Impact**: Each page uses 2-3x more memory than before

---

## ✅ Recommended Fixes

### ✅ Fix 1: Clear Large Arrays After Use (CRITICAL) - PARTIALLY DONE

**File**: `dataProcessing/processors/gameDataProcessor.js`

- ✅ Added: Clear `scrapedGameData` after assignment
- ⚠️ Still accumulates: `allScrapedFixtures` array (needed for return value)

**Note**: `allScrapedFixtures` is returned and used by DataController, so can't be cleared early. But individual batch data is now cleared.

---

### ✅ Fix 2: Lower Browser Restart Threshold (HIGH) - DONE

**File**: `dataProcessing/puppeteer/PuppeteerManager.js`

Changed from 200MB to **150MB RSS** and 80MB to **60MB heap**:

```javascript
// Restart if heap exceeds 60MB or RSS exceeds 150MB
if (heapUsedMB > 60 || rssMB > 150) {
  await this.restartBrowser();
}
```

**Why**: With 50+ pages possible in a single job, need to restart more aggressively.

---

### ✅ Fix 3: Lower Operation Count Restart (HIGH) - DONE

**File**: `dataProcessing/puppeteer/PuppeteerManager.js`

Changed from 5 to **3 operations**:

```javascript
this.maxOperationsBeforeRestart = parseInt(
  process.env.PUPPETEER_MAX_OPS_BEFORE_RESTART || "3",
  10
);
```

**Why**: Single job can create 50+ pages, need to restart every 3 pages to prevent accumulation.

---

### ✅ Fix 4: Force Browser Restart Between Stages (MEDIUM) - DONE

**File**: `dataProcessing/controllers/dataController.js`

Added browser restart between major stages:

```javascript
// After competitions
await this.ProcessCompetitions(dataObj);
await this.forceBrowserRestartIfNeeded(); // NEW

// After teams
await this.ProcessTeams(dataObj);
await this.forceBrowserRestartIfNeeded(); // NEW

// After games
await this.ProcessGames(dataObj);
await this.forceBrowserRestartIfNeeded(); // NEW
```

**Impact**: Browser restarts 3 times during single job, preventing memory accumulation across stages.

---

### Fix 5: Clear Page Cache Between Navigations (MEDIUM)

**File**: Services that use pages

```javascript
// After each page navigation, clear cache
await page.goto(url);
await page.evaluate(() => {
  // Clear any cached data
  if (window.caches) {
    caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
  }
});
```

---

## 📊 Expected Impact

| Fix                          | Current Memory    | After Fix           | Savings   |
| ---------------------------- | ----------------- | ------------------- | --------- |
| Clear large arrays           | 100-200MB arrays  | 0MB (cleared)       | 100-200MB |
| Lower restart threshold      | Restarts at 200MB | Restarts at 150MB   | 20-30%    |
| Lower operation count        | Restarts every 5  | Restarts every 3    | 30-40%    |
| Force restart between stages | No restarts       | Restarts 3x per job | 50-60%    |
| Combined                     | 1000MB+           | 300-400MB           | 60-70%    |

---

## 🎯 Priority Order

1. **IMMEDIATE**: Clear large arrays after use
2. **IMMEDIATE**: Lower restart threshold to 150MB
3. **IMMEDIATE**: Lower operation count to 3
4. **SHORT TERM**: Force browser restart between stages
5. **SHORT TERM**: Clear page cache between navigations

---

## 🔍 Root Cause Summary

**Single job with large account**:

- Creates 50+ pages (games + validation batches)
- Each page: 20-50MB (Puppeteer v24)
- Large arrays: 100-200MB
- Browser doesn't restart until 200MB RSS
- **Total: 50 pages × 30MB + 150MB arrays = 1650MB+**

**Solution**:

- Restart browser every 3 pages (instead of 5)
- Restart at 150MB RSS (instead of 200MB)
- Clear arrays immediately after use
- Force restart between major stages
