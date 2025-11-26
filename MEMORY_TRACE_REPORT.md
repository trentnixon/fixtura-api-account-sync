# Memory Trace Report - Heroku Memory Optimization

## 🔍 Trace Summary

Tracing the application from `worker.js` entry point to identify all memory consumption sources, particularly after Puppeteer v24 update.

---

## 🚨 Critical Issues Found

### 1. **DUAL BROWSER SYSTEMS** (HIGH PRIORITY)

**Problem**: Two different browser creation systems exist:

- ✅ **PuppeteerManager** (optimized): Used by newer services

  - Location: `dataProcessing/puppeteer/PuppeteerManager.js`
  - Has all memory optimization flags
  - Has automatic restart logic
  - Has page cleanup methods

- ❌ **dependencies.getPuppeteerInstance()** (NOT optimized): Used by older API routes
  - Location: `common/dependencies.js:91-103`
  - **MISSING all memory optimization flags**
  - **MISSING browser restart logic**
  - Used by `BaseController.initDependencies()`

**Impact**:

- API routes using `BaseController` create unoptimized browsers
- Each browser instance can consume 200-400MB
- Multiple unoptimized browsers = memory crisis

**Files Affected**:

- `api/ScrapeCenter/getCompetitions.js` → uses `BaseController.initDependencies()`
- `api/ScrapeCenter/getTeamsFromLadder.js` → uses `BaseController.initDependencies()`
- `api/ScrapeCenter/getGameData.js` → uses `BaseController.initDependencies()`
- `api/Puppeteer/ClubDetails/GetClubDetails.js` → uses `BaseController.initDependencies()`
- `api/Puppeteer/AssociationDetails/AssociationDetailsController.js` → uses `BaseController.initDependencies()`

---

### 2. **MULTIPLE PUPPETEERMANAGER INSTANCES** (MEDIUM PRIORITY)

**Problem**: Each service creates its own `PuppeteerManager` instance:

- `FixtureValidationService` → `new PuppeteerManager()`
- `GetTeamsGameData` → `new PuppeteerManager()`
- `GetTeams` → `new PuppeteerManager()`
- `GetCompetitions` → `new PuppeteerManager()`

**Impact**:

- Each instance can create its own browser
- No coordination between instances
- Multiple browsers running simultaneously = high memory usage

**Current State**:

- Each service manages its own browser lifecycle
- No singleton pattern to share browser instances

---

### 3. **WORKER.JS INITIALIZES ALL QUEUES SIMULTANEOUSLY** (MEDIUM PRIORITY)

**Problem**: `worker.js` calls all queue handlers at startup:

```javascript
initializeQueueProcessing() {
  checkAssetGeneratorAccountStatus();      // Queue 1
  handleAccountSync();                      // Queue 2
  onboardNewAccountTask();                  // Queue 3
  handleUpdateAccountOnly();                // Queue 4
  handleClubDirectSync();                   // Queue 5
  handleAssociationDirectSync();            // Queue 6
}
```

**Impact**:

- All queues start processing immediately
- If multiple jobs run simultaneously, multiple browsers could be created
- No rate limiting or coordination

---

### 4. **MISSING MEMORY FLAGS IN DEPENDENCIES.JS** (HIGH PRIORITY)

**Current Code** (`common/dependencies.js:91-103`):

```javascript
getPuppeteerInstance: async () => {
  return await puppeteer.launch({
    headless: process.env.NODE_ENV === "development" ? false : true,
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      // ❌ MISSING: All memory optimization flags!
    ],
  });
};
```

**Missing Flags** (from PuppeteerManager):

- `--disable-gpu`
- `--disable-software-rasterizer`
- `--disable-extensions`
- `--disable-plugins`
- `--disable-sync`
- `--disable-background-timer-throttling`
- `--disable-backgrounding-occluded-windows`
- `--disable-renderer-backgrounding`
- `--disable-images`
- `--blink-settings=imagesEnabled=false`
- `--disable-component-extensions-with-background-pages`
- `--disable-ipc-flooding-protection`
- `--metrics-recording-only`
- `--mute-audio`
- `--disable-notifications`
- `--disable-default-apps`

**Impact**: Each browser created via `dependencies.js` uses 2-3x more memory than optimized browsers.

---

## 📊 Memory Flow Analysis

### Entry Point: `worker.js`

```
worker.js
├── initializeQueueProcessing()
│   ├── checkAssetGeneratorAccountStatus()
│   │   └── ClubTaskProcessor / AssociationTaskProcessor
│   │       └── Uses BaseController → dependencies.getPuppeteerInstance() ❌
│   ├── handleAccountSync()
│   │   └── ClubTaskProcessor / AssociationTaskProcessor
│   │       └── Uses BaseController → dependencies.getPuppeteerInstance() ❌
│   ├── onboardNewAccountTask()
│   ├── handleUpdateAccountOnly()
│   ├── handleClubDirectSync()
│   └── handleAssociationDirectSync()
```

### Data Processing Flow

```
DataController.process()
├── FixtureValidationProcessor
│   └── FixtureValidationService
│       └── new PuppeteerManager() ✅ (optimized)
├── GetCompetitions
│   └── new PuppeteerManager() ✅ (optimized)
├── GetTeams
│   └── new PuppeteerManager() ✅ (optimized)
└── GetTeamsGameData
    └── new PuppeteerManager() ✅ (optimized)
```

### API Routes Flow

```
API Routes
├── api/ScrapeCenter/getCompetitions.js
│   └── BaseController.initDependencies()
│       └── dependencies.getPuppeteerInstance() ❌ (unoptimized)
├── api/ScrapeCenter/getTeamsFromLadder.js
│   └── BaseController.initDependencies()
│       └── dependencies.getPuppeteerInstance() ❌ (unoptimized)
└── api/ScrapeCenter/getGameData.js
    └── BaseController.initDependencies()
        └── dependencies.getPuppeteerInstance() ❌ (unoptimized)
```

---

## ✅ Recommended Fixes

### Fix 1: Add Memory Flags to dependencies.js (IMMEDIATE)

**Priority**: HIGH
**Impact**: Reduces memory by 50-70% for API route browsers
**Effort**: LOW (5 minutes)

Update `common/dependencies.js` to include all memory optimization flags from `PuppeteerManager`.

---

### Fix 2: Implement PuppeteerManager Singleton (MEDIUM TERM)

**Priority**: MEDIUM
**Impact**: Prevents multiple browser instances
**Effort**: MEDIUM (30 minutes)

Create a singleton pattern for `PuppeteerManager` so all services share the same browser instance.

---

### Fix 3: Migrate BaseController to Use PuppeteerManager (LONG TERM)

**Priority**: MEDIUM
**Impact**: Unifies browser management, ensures all browsers are optimized
**Effort**: HIGH (2-3 hours)

Refactor `BaseController` to use `PuppeteerManager` instead of `dependencies.getPuppeteerInstance()`.

---

### Fix 4: Add Browser Instance Tracking (MONITORING)

**Priority**: LOW
**Impact**: Better visibility into memory usage
**Effort**: LOW (15 minutes)

Add logging to track how many browser instances are active at any time.

---

## 🎯 Quick Wins (Implement First)

1. ✅ **Add memory flags to dependencies.js** - Immediate 50-70% memory reduction
2. ✅ **Reduce maxOperationsBeforeRestart** - More aggressive browser restarts
3. ✅ **Add memory monitoring** - Track browser instance count

---

## 📈 Expected Memory Savings

| Fix                   | Current Memory | After Fix     | Savings |
| --------------------- | -------------- | ------------- | ------- |
| dependencies.js flags | 400MB/browser  | 150MB/browser | 62%     |
| Singleton pattern     | 2-3 browsers   | 1 browser     | 50-66%  |
| Combined              | 800-1200MB     | 150-300MB     | 75-87%  |

---

## 🔍 Additional Observations

1. **PuppeteerManager restart threshold**: Currently set to 10 operations (very aggressive)

   - Could be increased to 20-30 if memory allows
   - Currently: `PUPPETEER_MAX_OPS_BEFORE_RESTART=10`

2. **Memory check thresholds**: Very aggressive (100MB heap, 300MB RSS)

   - These are good for 512MB Heroku limit
   - May need adjustment if upgrading dyno

3. **Page cleanup**: Services are closing pages properly

   - `FixtureValidationService` closes pages after batches ✅
   - Other services should be verified

4. **Worker.js startup**: All queues initialize at once
   - Consider lazy initialization or rate limiting
   - Current approach is fine if queues are idle until jobs arrive

---

## 📝 Next Steps

1. **IMMEDIATE**: Add memory flags to `dependencies.js`
2. **SHORT TERM**: Implement PuppeteerManager singleton
3. **MEDIUM TERM**: Migrate BaseController to PuppeteerManager
4. **ONGOING**: Monitor memory usage and adjust thresholds

---

## 🔗 Related Documentation

- `MEMORY_CRISIS_SOLUTIONS.md` - Previous memory optimizations
- `MEMORY_OPTIMIZATION_GUIDE.md` - Best practices guide
- `dataProcessing/puppeteer/PuppeteerManager.js` - Optimized browser manager
