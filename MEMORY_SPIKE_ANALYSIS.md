# Memory Spike Analysis - 1GB Heroku Limit

## 🚨 Critical Issues Found

### 1. **SERVICES DISPOSING SHARED SINGLETON** (CRITICAL)

**Problem**: Services are calling `dispose()` on the shared PuppeteerManager singleton:

- `getCompetitions.js:93` → `await this.puppeteerManager.dispose()`
- `getTeamsFromLadder.js:80` → `await this.puppeteerManager.dispose()`
- `getGameData.js:71` → `await this.puppeteerManager.dispose()`

**Impact**:

- All services share the same singleton instance
- When one service calls `dispose()`, it closes the browser for ALL services
- If multiple services run simultaneously (queue jobs), this causes:
  - Browser closed while other services are still using it
  - Services create new browsers after dispose
  - Multiple browsers running simultaneously = memory spike

**Fix**: Services should close their pages individually, NOT call `dispose()` on the shared singleton.

---

### 2. **PAGES NOT BEING CLOSED INDIVIDUALLY** (HIGH)

**Problem**: Services create pages but don't close them before calling `dispose()`:

```javascript
// Current (BAD):
const page = await this.puppeteerManager.createPageInNewContext();
// ... use page ...
await this.puppeteerManager.dispose(); // Closes everything, but pages accumulate first
```

**Impact**:

- Pages accumulate in memory until `dispose()` is called
- If multiple services run, pages accumulate across all services
- Each page can hold 10-50MB of DOM/cache data

**Fix**: Close pages immediately after use:

```javascript
// Fixed (GOOD):
const page = await this.puppeteerManager.createPageInNewContext();
try {
  // ... use page ...
} finally {
  await this.puppeteerManager.closePage(page); // Close immediately
}
```

---

### 3. **MULTIPLE BROWSERS FROM BASECONTROLLER** (HIGH)

**Problem**: Queue jobs using `BaseController` create separate browsers via `dependencies.getPuppeteerInstance()`:

- Even with memory flags, these are separate browser instances
- If multiple queue jobs run simultaneously, multiple browsers are created
- Each browser = 150-300MB

**Impact**:

- Queue job 1 → creates browser 1 (300MB)
- Queue job 2 → creates browser 2 (300MB)
- Queue job 3 → creates browser 3 (300MB)
- Total: 900MB+ just from browsers

**Fix**: Migrate BaseController to use PuppeteerManager singleton (longer-term) OR ensure only one queue job runs at a time.

---

### 4. **MEMORY RESTART THRESHOLD TOO HIGH** (MEDIUM)

**Problem**: Restart threshold is 300MB RSS, but we're hitting 1GB:

```javascript
// Current threshold
if (heapUsedMB > 100 || rssMB > 300) {
  await this.restartBrowser();
}
```

**Impact**: Browser only restarts at 300MB, but memory can spike to 1GB before restart happens.

**Fix**: Lower threshold to 200MB RSS to restart more aggressively.

---

### 5. **OPERATION COUNT RESTART TOO HIGH** (MEDIUM)

**Problem**: Restarts every 10 operations, but with multiple services using singleton, this accumulates:

- Service 1: 5 operations
- Service 2: 5 operations
- Service 3: 5 operations
- Total: 15 operations before restart

**Impact**: Browser runs longer, accumulates more memory.

**Fix**: Lower to 5 operations OR restart based on memory, not just operation count.

---

### 6. **PUPPETEER V24 MEMORY CHARACTERISTICS** (UNKNOWN)

**Problem**: User reports this wasn't an issue with previous Puppeteer version.

**Possible causes**:

- Puppeteer v24 uses more memory per page
- Different garbage collection behavior
- More aggressive caching
- Different page lifecycle

**Investigation needed**: Compare Puppeteer v23 vs v24 memory usage.

---

## ✅ Immediate Fixes Applied

### ✅ Fix 1: Removed dispose() calls from services (CRITICAL) - DONE

**Fixed Files**:

- `dataProcessing/scrapeCenter/Competitions/getCompetitions.js`
- `dataProcessing/scrapeCenter/Ladder/getTeamsFromLadder.js`
- `dataProcessing/scrapeCenter/GameData/getGameData.js`

**Change**: Services now close pages individually instead of calling `dispose()` on shared singleton.

### ✅ Fix 2: Pages closed immediately (HIGH) - DONE

All services now close pages in `finally` blocks:

```javascript
let page = null;
try {
  page = await this.puppeteerManager.createPageInNewContext();
  // ... use page ...
} finally {
  if (page) {
    await this.puppeteerManager.closePage(page);
  }
}
```

### ✅ Fix 3: Lowered memory restart threshold (MEDIUM) - DONE

Changed from 300MB to 200MB RSS to restart more aggressively.

- Old: `rssMB > 300`
- New: `rssMB > 200`
- Also lowered heap threshold from 100MB to 80MB

### ✅ Fix 4: Lowered operation count restart (MEDIUM) - DONE

Changed from 10 to 5 operations to restart more frequently.

- Old: `PUPPETEER_MAX_OPS_BEFORE_RESTART=10`
- New: `PUPPETEER_MAX_OPS_BEFORE_RESTART=5` (default)

---

## 📊 Expected Impact

| Fix                      | Current Memory    | After Fix                | Savings |
| ------------------------ | ----------------- | ------------------------ | ------- |
| Remove dispose() calls   | Multiple browsers | 1 browser                | 50-70%  |
| Close pages individually | Pages accumulate  | Pages closed immediately | 30-50%  |
| Lower restart threshold  | Restarts at 300MB | Restarts at 200MB        | 20-30%  |
| Combined                 | 1000MB+           | 300-400MB                | 60-70%  |

---

## 🎯 Priority Order

1. **IMMEDIATE**: Fix services calling `dispose()` on singleton
2. **IMMEDIATE**: Add page closing in all services
3. **SHORT TERM**: Lower memory restart threshold
4. **SHORT TERM**: Lower operation count restart
5. **MEDIUM TERM**: Migrate BaseController to PuppeteerManager
